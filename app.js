/**
 * App.js - Tech News Dashboard Controller
 * ---------------------------------------
 * Handles loading data, calculating BI KPIs, rendering Chart.js charts,
 * managing filters (search, technology, sentiment, source), and state sorting.
 */

// Global Dashboard State
let articles = [];
let filteredArticles = [];
let sentimentChart = null;
let techChart = null;

// Filter and Sort Configuration
const filterConfig = {
  searchQuery: "",
  selectedTag: "All",
  selectedSentiment: "All",
  sources: {
    HackerNews: true,
    Slashdot: true
  },
  sortBy: "newest"
};

// Colors mapping matching styles.css HSL configurations
const themeColors = {
  primary: '#818cf8',
  cyan: '#06b6d4',
  green: '#10b981',
  orange: '#f59e0b',
  red: '#f43f5e',
  muted: '#94a3b8',
  cardBg: 'rgba(22, 28, 45, 0.45)',
  gridLine: 'rgba(255, 255, 255, 0.05)'
};

// Initialize Dashboard on Document Load
document.addEventListener("DOMContentLoaded", () => {
  initEventListeners();
  loadData();
});

// Load news data from data.json
async function loadData() {
  try {
    const response = await fetch("data.json");
    if (!response.ok) {
      throw new Error("Could not load data.json database");
    }
    articles = await response.json();
    applyFilters();
  } catch (error) {
    console.error("Error loading dashboard data:", error);
    // Display error fallback data or alert
    articles = [];
    applyFilters();
  }
}

// Set up UI Event Listeners
function initEventListeners() {
  // Search Input
  const searchInput = document.getElementById("search-input");
  searchInput.addEventListener("input", (e) => {
    filterConfig.searchQuery = e.target.value.toLowerCase().trim();
    applyFilters();
  });

  // Tech Category Buttons
  const tagButtons = document.querySelectorAll(".tag-btn");
  tagButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      tagButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      filterConfig.selectedTag = btn.dataset.tag;
      applyFilters();
    });
  });

  // Sentiment Filter Buttons
  const sentimentButtons = document.querySelectorAll(".sentiment-btn");
  sentimentButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      sentimentButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      filterConfig.selectedSentiment = btn.dataset.sentiment;
      applyFilters();
    });
  });

  // Source Checkboxes
  const hnCheck = document.getElementById("source-hn-check");
  const sdCheck = document.getElementById("source-sd-check");
  
  hnCheck.addEventListener("change", (e) => {
    filterConfig.sources.HackerNews = e.target.checked;
    applyFilters();
  });
  sdCheck.addEventListener("change", (e) => {
    filterConfig.sources.Slashdot = e.target.checked;
    applyFilters();
  });

  // Sort Dropdown
  const sortSelect = document.getElementById("sort-select");
  sortSelect.addEventListener("change", (e) => {
    filterConfig.sortBy = e.target.value;
    applyFilters();
  });

  // Reset Filters Button (No results state)
  document.getElementById("reset-filters-btn").addEventListener("click", () => {
    searchInput.value = "";
    filterConfig.searchQuery = "";
    
    tagButtons.forEach(b => b.classList.remove("active"));
    tagButtons[0].classList.add("active");
    filterConfig.selectedTag = "All";
    
    sentimentButtons.forEach(b => b.classList.remove("active"));
    sentimentButtons[0].classList.add("active");
    filterConfig.selectedSentiment = "All";
    
    hnCheck.checked = true;
    sdCheck.checked = true;
    filterConfig.sources.HackerNews = true;
    filterConfig.sources.Slashdot = true;
    
    applyFilters();
  });

  // Sync / Ingestion Data Reload Button
  const syncBtn = document.getElementById("run-pipeline-btn");
  syncBtn.addEventListener("click", async () => {
    syncBtn.disabled = true;
    const icon = syncBtn.querySelector("i");
    icon.classList.add("fa-spin");
    
    // Simulate active refresh of script pipeline
    setTimeout(async () => {
      await loadData();
      icon.classList.remove("fa-spin");
      syncBtn.disabled = false;
      
      // Flash the KPI container to show update
      const kpis = document.querySelector(".kpi-grid");
      kpis.style.transform = "scale(0.99)";
      setTimeout(() => kpis.style.transform = "none", 150);
    }, 1200);
  });
}

// Filter, Sort, and Render Data
function applyFilters() {
  // 1. Filtering
  filteredArticles = articles.filter(art => {
    // Search Query Match
    const matchesSearch = !filterConfig.searchQuery || 
      art.title.toLowerCase().includes(filterConfig.searchQuery) ||
      art.description.toLowerCase().includes(filterConfig.searchQuery);
    
    // Tech Tag Match
    const matchesTag = filterConfig.selectedTag === "All" || 
      art.tags.includes(filterConfig.selectedTag);
    
    // Sentiment Match
    const matchesSentiment = filterConfig.selectedSentiment === "All" ||
      art.sentiment_label === filterConfig.selectedSentiment;
      
    // Source Match
    const matchesSource = filterConfig.sources[art.source] === true;

    return matchesSearch && matchesTag && matchesSentiment && matchesSource;
  });

  // 2. Sorting
  filteredArticles.sort((a, b) => {
    if (filterConfig.sortBy === "newest") {
      return new Date(b.timestamp) - new Date(a.timestamp);
    }
    if (filterConfig.sortBy === "oldest") {
      return new Date(a.timestamp) - new Date(b.timestamp);
    }
    if (filterConfig.sortBy === "sentiment-desc") {
      return b.sentiment_score - a.sentiment_score;
    }
    if (filterConfig.sortBy === "sentiment-asc") {
      return a.sentiment_score - b.sentiment_score;
    }
    return 0;
  });

  // 3. Render Views
  renderKPIs();
  renderCharts();
  renderFeed();
}

// Compute metrics and update KPI Cards
function renderKPIs() {
  // 1. Total processed articles
  document.getElementById("val-total-articles").innerText = articles.length;

  // 2. Average Sentiment
  const validSentimentArticles = articles.filter(a => typeof a.sentiment_score === 'number');
  let avgSentiment = 0.0;
  if (validSentimentArticles.length > 0) {
    const totalSentiment = validSentimentArticles.reduce((sum, current) => sum + current.sentiment_score, 0);
    avgSentiment = totalSentiment / validSentimentArticles.length;
  }
  
  const sentimentValueEl = document.getElementById("val-avg-sentiment");
  const sentimentLabelEl = document.getElementById("val-avg-sentiment-label");
  const iconBox = document.getElementById("avg-sentiment-icon-box");
  
  sentimentValueEl.innerText = (avgSentiment >= 0 ? "+" : "") + avgSentiment.toFixed(2);
  
  // Color code dynamic updates based on average index score
  iconBox.className = "kpi-icon-wrapper"; // Reset
  if (avgSentiment > 0.15) {
    sentimentLabelEl.innerText = "Overall Positive";
    sentimentLabelEl.className = "kpi-trend trend-up";
    iconBox.classList.add("color-green");
    iconBox.innerHTML = '<i class="fa-solid fa-face-smile"></i>';
  } else if (avgSentiment < -0.15) {
    sentimentLabelEl.innerText = "Overall Negative";
    sentimentLabelEl.className = "kpi-trend trend-down";
    iconBox.classList.add("color-red");
    iconBox.innerHTML = '<i class="fa-solid fa-face-frown"></i>';
  } else {
    sentimentLabelEl.innerText = "Overall Neutral";
    sentimentLabelEl.className = "kpi-trend trend-neutral";
    iconBox.classList.add("color-cyan");
    iconBox.innerHTML = '<i class="fa-solid fa-face-meh"></i>';
  }

  // 3. Most Popular Topic Tag
  const tagCounts = {};
  articles.forEach(art => {
    art.tags.forEach(tag => {
      if (tag !== "General") {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    });
  });
  
  let topTag = "N/A";
  let maxCount = 0;
  for (const [tag, count] of Object.entries(tagCounts)) {
    if (count > maxCount) {
      maxCount = count;
      topTag = tag;
    }
  }
  document.getElementById("val-top-topic").innerText = topTag;
  document.getElementById("val-top-topic-count").innerText = `${maxCount} Mentions`;

  // 4. Critical Threat Alerts (Sentiment <= -0.5)
  const criticalThreats = articles.filter(art => art.sentiment_score <= -0.5).length;
  const alertEl = document.getElementById("val-critical-alerts");
  const alertIconBox = document.getElementById("critical-alerts-icon-box");
  const alertDesc = document.getElementById("val-critical-alerts-desc");
  
  alertEl.innerText = criticalThreats;
  alertIconBox.className = "kpi-icon-wrapper"; // Reset
  
  if (criticalThreats > 0) {
    alertIconBox.classList.add("color-red");
    alertIconBox.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
    alertDesc.className = "kpi-trend trend-down";
    alertDesc.innerText = `${criticalThreats} Severe Threats`;
    
    // Add pulsing indicator if threats exist
    alertIconBox.classList.add("pulse");
  } else {
    alertIconBox.classList.add("color-green");
    alertIconBox.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
    alertDesc.className = "kpi-trend trend-up";
    alertDesc.innerText = "System Secure";
    alertIconBox.classList.remove("pulse");
  }
}

// Generate & Render Charts using Chart.js
function renderCharts() {
  // --- Chart 1: Sentiment Breakdown (Doughnut) ---
  const positiveCount = articles.filter(a => a.sentiment_label === "Positive").length;
  const neutralCount = articles.filter(a => a.sentiment_label === "Neutral").length;
  const negativeCount = articles.filter(a => a.sentiment_label === "Negative").length;

  const sentimentCtx = document.getElementById("sentimentDoughnutChart").getContext("2d");
  
  if (sentimentChart) {
    sentimentChart.destroy();
  }

  // Check if zero data
  if (articles.length === 0) {
    sentimentCtx.font = "14px Inter";
    sentimentCtx.fillStyle = themeColors.muted;
    sentimentCtx.textAlign = "center";
    sentimentCtx.fillText("No data available to display", 100, 100);
  } else {
    sentimentChart = new Chart(sentimentCtx, {
      type: "doughnut",
      data: {
        labels: ["Positive", "Neutral", "Negative"],
        datasets: [{
          data: [positiveCount, neutralCount, negativeCount],
          backgroundColor: [
            "rgba(16, 185, 129, 0.2)", // Green
            "rgba(148, 163, 184, 0.2)", // Grey
            "rgba(244, 63, 94, 0.2)"   // Red
          ],
          borderColor: [
            themeColors.green,
            themeColors.muted,
            themeColors.red
          ],
          borderWidth: 1.5,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              color: themeColors.muted,
              font: { family: "Inter", size: 11 },
              padding: 15
            }
          },
          tooltip: {
            backgroundColor: "#1e293b",
            titleFont: { family: "Outfit", size: 13 },
            bodyFont: { family: "Inter", size: 12 },
            borderColor: "rgba(255,255,255,0.08)",
            borderWidth: 1
          }
        },
        cutout: "70%"
      }
    });
  }

  // --- Chart 2: Technology Topic Volumes (Bar Chart) ---
  const techCategories = ["AI/ML", "Python", "Web Dev", "Cloud", "Big Data", "Database", "Security"];
  const techLabels = ["AI / ML", "Python", "Web Dev", "Cloud Stack", "Big Data", "Database", "Security"];
  const dataCounts = techCategories.map(cat => {
    return articles.filter(art => art.tags.includes(cat)).length;
  });

  const techCtx = document.getElementById("techVolumeBarChart").getContext("2d");
  
  if (techChart) {
    techChart.destroy();
  }

  const gradient = techCtx.createLinearGradient(0, 0, 0, 300);
  gradient.addColorStop(0, 'rgba(6, 182, 212, 0.7)'); // Cyan glow
  gradient.addColorStop(1, 'rgba(129, 140, 248, 0.2)'); // Indigo fading

  techChart = new Chart(techCtx, {
    type: "bar",
    data: {
      labels: techLabels,
      datasets: [{
        label: "Article Mentions",
        data: dataCounts,
        backgroundColor: gradient,
        borderColor: themeColors.cyan,
        borderWidth: 1.5,
        borderRadius: 6,
        barPercentage: 0.6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: themeColors.muted,
            font: { family: "Inter", size: 10 }
          }
        },
        y: {
          grid: { color: themeColors.gridLine },
          ticks: {
            color: themeColors.muted,
            font: { family: "Inter", size: 10 },
            stepSize: 1
          }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#1e293b",
          titleFont: { family: "Outfit", size: 13 },
          bodyFont: { family: "Inter", size: 12 },
          borderColor: "rgba(255,255,255,0.08)",
          borderWidth: 1
        }
      }
    }
  });
}

// Render dynamic Feed Article items
function renderFeed() {
  const feedList = document.getElementById("news-feed-list");
  const noResults = document.getElementById("no-results-card");
  const countEl = document.getElementById("articles-count");
  
  feedList.innerHTML = "";
  countEl.innerText = filteredArticles.length;

  if (filteredArticles.length === 0) {
    noResults.classList.remove("hide");
    return;
  } else {
    noResults.classList.add("hide");
  }

  filteredArticles.forEach(art => {
    // Determine Sentiment classing
    let sentimentClass = "sentiment-neutral";
    let badgeClass = "badge-neutral";
    let badgeIcon = "fa-circle-minus";
    
    if (art.sentiment_label === "Positive") {
      sentimentClass = "sentiment-positive";
      badgeClass = "badge-positive";
      badgeIcon = "fa-circle-check";
    } else if (art.sentiment_label === "Negative") {
      sentimentClass = "sentiment-negative";
      badgeClass = "badge-negative";
      badgeIcon = "fa-circle-xmark";
    }

    // Parse timestamp
    let relativeTime = "Recent";
    try {
      const date = new Date(art.timestamp);
      relativeTime = date.toLocaleDateString(undefined, {
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit'
      });
    } catch (e) {
      console.warn("Date parsing error", e);
    }

    // Build Tag Capsules
    const tagHtml = art.tags
      .map(tag => `<span class="tag-capsule">${tag}</span>`)
      .join("");

    // Build news card HTML structure
    const card = document.createElement("article");
    card.className = `news-card glass ${sentimentClass}`;
    card.innerHTML = `
      <div class="news-card-header">
        <a href="${art.link}" target="_blank" class="news-title" rel="noopener noreferrer">
          ${art.title} <i class="fa-solid fa-arrow-up-right-from-square"></i>
        </a>
        <span class="sentiment-badge ${badgeClass}">
          <i class="fa-solid ${badgeIcon}"></i> 
          ${art.sentiment_label} (${(art.sentiment_score >= 0 ? "+" : "") + art.sentiment_score.toFixed(2)})
        </span>
      </div>
      <p class="news-desc">${art.description}</p>
      <div class="news-card-footer">
        <div class="meta-details">
          <span class="meta-item"><i class="fa-solid fa-building-columns"></i> Feed: <strong>${art.source}</strong></span>
          <span class="meta-item"><i class="fa-solid fa-clock"></i> Ingested: <strong>${relativeTime}</strong></span>
        </div>
        <div class="article-tags">
          ${tagHtml}
        </div>
      </div>
    `;

    feedList.appendChild(card);
  });
}
