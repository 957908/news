#!/usr/bin/env python3
"""
Tech News Data & Sentiment Pipeline
-----------------------------------
A Python utility designed to ingest news from technology feeds, perform NLP-based
sentiment scoring and keyword extraction, and compile a structured dataset
for the BI Dashboard interface.

Author: Senior Python Developer / Data Analyst
"""

import os
import json
import re
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
import random

# Configuration
FEEDS = {
    "HackerNews": "https://news.ycombinator.com/rss",
    "Slashdot": "https://slashdot.org/slashdot.rss"
}

OUTPUT_FILE = "data.json"

# Lexicons for Sentiment Analysis
POSITIVE_WORDS = {
    "breakthrough", "success", "innovative", "revolution", "growth", "smart", "improve",
    "upgrade", "efficient", "faster", "powerful", "secure", "trust", "excellent", "creative",
    "boost", "gain", "profit", "love", "awesome", "great", "enable", "support", "benefit",
    "optimize", "simplify", "leading", "top", "robust", "stable", "scalable", "advanced"
}

NEGATIVE_WORDS = {
    "fail", "bug", "vulnerability", "leak", "exploit", "hack", "breach", "crash", "down",
    "outage", "risk", "threat", "lawsuit", "fine", "decline", "slow", "expensive", "loss",
    "error", "issue", "warn", "defect", "ban", "block", "cancel", "abandon", "legacy",
    "unsafe", "critical", "attack", "fraud", "scam", "breach", "layoff", "fired", "shutdown"
}

TECH_KEYWORDS = {
    "AI/ML": [r"\bai\b", r"\bml\b", r"llm", r"gpt", r"claude", r"deepmind", r"gemini", r"neural", r"tensor", r"pytorch", r"transformer", r"learning"],
    "Python": [r"python", r"django", r"flask", r"pandas", r"numpy", r"fastapi", r"pip", r"conda"],
    "Web Dev": [r"javascript", r"js\b", r"react", r"next\.js", r"vue", r"tailwind", r"node", r"frontend", r"css", r"html"],
    "Cloud": [r"aws", r"azure", r"gcp", r"kubernetes", r"docker", r"serverless", r"cloud", r"s3", r"lambda"],
    "Big Data": [r"spark", r"hadoop", r"kafka", r"lakehouse", r"warehouse", r"snowflake", r"databricks", r"parquet", r"analytics", r"bi\b"],
    "Database": [r"sql", r"postgres", r"mongodb", r"database", r"redis", r"sqlite", r"nosql"],
    "Security": [r"security", r"cyber", r"encryption", r"vulnerability", r"exploit", r"ransomware", r"hacker", r"auth"]
}

def clean_html(raw_html):
    """Removes HTML tags and cleans up whitespace."""
    if not raw_html:
        return ""
    cleanr = re.compile('<.*?>')
    cleantext = re.sub(cleanr, '', raw_html)
    return " ".join(cleantext.split())

def calculate_sentiment(text):
    """Simple lexicon-based sentiment analysis scoring from -1.0 to 1.0."""
    words = re.findall(r'\b\w+\b', text.lower())
    if not words:
        return 0.0
    
    pos_count = sum(1 for w in words if w in POSITIVE_WORDS)
    neg_count = sum(1 for w in words if w in NEGATIVE_WORDS)
    
    total = pos_count + neg_count
    if total == 0:
        return 0.0
    
    score = (pos_count - neg_count) / total
    # Cap and return rounded sentiment
    return round(score, 2)

def extract_tech_tags(text):
    """Identifies matching tech domains based on keyword patterns."""
    text_lower = text.lower()
    tags = []
    for tag, patterns in TECH_KEYWORDS.items():
        for pattern in patterns:
            if re.search(pattern, text_lower):
                tags.append(tag)
                break
    
    if not tags:
        tags.append("General")
    return list(set(tags))

def fetch_rss_feed(url):
    """Fetches and parses an RSS feed, returning parsed articles."""
    articles = []
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=8) as response:
            xml_data = response.read()
        
        root = ET.fromstring(xml_data)
        for item in root.findall('.//item'):
            title = clean_html(item.find('title').text if item.find('title') is not None else "")
            link = item.find('link').text if item.find('link') is not None else ""
            desc = clean_html(item.find('description').text if item.find('description') is not None else "")
            
            # PubDate parsing fallback
            pub_date_str = item.find('pubDate').text if item.find('pubDate') is not None else ""
            try:
                # E.g. "Sun, 19 Jul 2026 05:00:00 GMT"
                dt = datetime.strptime(pub_date_str[:25].strip(), "%a, %d %b %Y %H:%M:%S")
                timestamp = dt.strftime("%Y-%m-%dT%H:%M:%SZ")
            except Exception:
                timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
            
            articles.append({
                "title": title,
                "link": link,
                "description": desc or title,
                "timestamp": timestamp,
                "source": "RSS Feed"
            })
    except Exception as e:
        print(f"Error fetching feed {url}: {e}")
    return articles

def generate_enrichment_analytics(articles):
    """Enriches articles with sentiment scores, labels, and tags."""
    enriched = []
    for art in articles:
        full_text = f"{art['title']} {art['description']}"
        sentiment_score = calculate_sentiment(full_text)
        
        if sentiment_score > 0.15:
            sentiment_label = "Positive"
        elif sentiment_score < -0.15:
            sentiment_label = "Negative"
        else:
            sentiment_label = "Neutral"
            
        tags = extract_tech_tags(full_text)
        
        enriched.append({
            "title": art["title"],
            "link": art["link"],
            "description": art["description"],
            "timestamp": art["timestamp"],
            "source": art["source"],
            "sentiment_score": sentiment_score,
            "sentiment_label": sentiment_label,
            "tags": tags
        })
    return enriched

def run_pipeline():
    """Main pipeline execution loop."""
    print("Starting news pipeline ingestion...")
    all_articles = []
    
    # 1. Fetch live RSS articles
    for name, url in FEEDS.items():
        print(f"Fetching RSS feed from {name}...")
        feed_articles = fetch_rss_feed(url)
        for a in feed_articles:
            a["source"] = name
        all_articles.extend(feed_articles)
        print(f"Ingested {len(feed_articles)} articles from {name}.")
        
    # 2. Enrich articles
    enriched_new = generate_enrichment_analytics(all_articles)
    
    # 3. Load existing historical data or seed standard baseline
    existing_data = []
    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
                existing_data = json.load(f)
            print(f"Loaded {len(existing_data)} existing articles from {OUTPUT_FILE}.")
        except Exception as e:
            print(f"Failed to read existing data: {e}")
            
    # De-duplicate by title
    existing_titles = {art["title"] for art in existing_data}
    new_adds = []
    for art in enriched_new:
        if art["title"] not in existing_titles:
            new_adds.append(art)
            
    combined = new_adds + existing_data
    # Limit to top 150 items to keep UI responsive
    combined = sorted(combined, key=lambda x: x["timestamp"], reverse=True)[:150]
    
    # Save output
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(combined, f, indent=2, ensure_ascii=False)
        
    print(f"Pipeline executed successfully. Total articles in storage: {len(combined)}.")

if __name__ == "__main__":
    run_pipeline()
