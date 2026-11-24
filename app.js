/**
 * CLT層構成別 熱貫流率（U値）理論値シミュレーター
 * 強軸 = CLT奇数層 (1, 3, 5[, 7])
 * 弱軸 = CLT偶数層 (2, 4[, 6])
 */

const STORAGE_KEY = "clt_uvalue_simulator_v1";

const DEFAULT_PARAMS = {
  slope: -0.0004,
  intercept: 0.0957,
  ri: 1 / 9,
  ro: 1 / 9,
  thickness: 0.03
};

const CIRCLED_NUMBERS = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩", "⑪", "⑫"];

const PRESET_CANDIDATES = [
  { memo: "無垢CLT（基準）", outer: 0, weak: 0, inner: 0 },
  { memo: "弱軸のみ40%ボイド", outer: 0, weak: 40, inner: 0 },
  { memo: "強軸10%＋弱軸40%", outer: 10, weak: 40, inner: 10 },
  { memo: "強軸11.22%(繊維方向)＋弱軸40%", outer: 11.22, weak: 40, inner: 11.22 },
  { memo: "全ラミナ45%ボイド", outer: 45, weak: 45, inner: 45 }
];

let state = {
  layers: 5, // 5 or 7
  params: { ...DEFAULT_PARAMS },
  selectedIndex: 0,
  candidates: [
    { memo: "基準候補", outer: 0, weak: null, inner: null },
    { memo: "", outer: null, weak: null, inner: null },
    { memo: "", outer: null, weak: null, inner: null },
    { memo: "", outer: null, weak: null, inner: null },
    { memo: "", outer: null, weak: null, inner: null }
  ]
};

// Load saved state if available
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && (parsed.layers === 5 || parsed.layers === 7)) {
      state.layers = parsed.layers;
    }
    if (parsed && parsed.params) {
      state.params = { ...DEFAULT_PARAMS, ...parsed.params };
    }
    if (parsed && Array.isArray(parsed.candidates) && parsed.candidates.length > 0) {
      state.candidates = parsed.candidates;
    }
    if (typeof parsed.selectedIndex === "number" && parsed.selectedIndex < state.candidates.length) {
      state.selectedIndex = parsed.selectedIndex;
    }
  } catch (e) {
    console.warn("Failed to load saved state:", e);
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("Failed to save state:", e);
  }
}

// Calculation helpers
function calcLambda(porosityPct, params) {
  if (porosityPct === null || porosityPct === "" || Number.isNaN(Number(porosityPct))) {
    return null;
  }
  const p = Number(porosityPct);
  const lam = params.slope * p + params.intercept;
  return lam > 0 ? lam : null;
}

function calcUValue(outerPct, weakPct, innerPct, layers, params) {
  const lOut = calcLambda(outerPct, params);
  const lWeak = calcLambda(weakPct, params);
  const lIn = calcLambda(innerPct, params);

  if (lOut === null || lWeak === null || lIn === null) {
    return { lOut, lWeak, lIn, rTotal: null, uValue: null };
  }

  const d = params.thickness;
  const rSurface = params.ri + params.ro;

  // 5-layer: outer strong = 2 layers (1,5), weak = 2 layers (2,4), inner strong = 1 layer (3)
  // 7-layer: outer strong = 2 layers (1,7), weak = 3 layers (2,4,6), inner strong = 2 layers (3,5)
  const nOut = 2;
  const nWeak = layers === 7 ? 3 : 2;
  const nIn = layers === 7 ? 2 : 1;

  const rTotal = rSurface + (nOut * d) / lOut + (nWeak * d) / lWeak + (nIn * d) / lIn;
  const uValue = rTotal > 0 ? 1 / rTotal : null;

  return { lOut, lWeak, lIn, rTotal, uValue };
}

function getCandidateLabel(idx) {
  return CIRCLED_NUMBERS[idx] || `(${idx + 1})`;
}

// Sync parameter inputs with state
function syncParamInputs() {
  document.getElementById("paramSlope").value = state.params.slope;
  document.getElementById("paramIntercept").value = state.params.intercept;
  document.getElementById("paramRi").value = Number(state.params.ri.toFixed(4));
  document.getElementById("paramRo").value = Number(state.params.ro.toFixed(4));
  document.getElementById("paramThickness").value = state.params.thickness;
  updateSurfaceDisplay();
}

function updateSurfaceDisplay() {
  const totalSurf = state.params.ri + state.params.ro;
  document.getElementById("displayRTotalSurface").innerHTML =
    `${totalSurf.toFixed(4)} <small>㎡·K/W</small>`;
}

// Update layer mode UI texts
function updateLayerModeUI() {
  const is7 = state.layers === 7;
  document.getElementById("btnMode5").classList.toggle("active", !is7);
  document.getElementById("btnMode7").classList.toggle("active", is7);

  const totalMm = Math.round(state.layers * state.params.thickness * 1000);
  document.getElementById("tableModeLabel").textContent =
    `${state.layers}層構成：総厚 ${totalMm}mm`;

  if (is7) {
    document.getElementById("legendStrongText").textContent = "第1・3・5・7層（最外層2層＋内層2層）";
    document.getElementById("legendWeakText").textContent = "第2・4・6層（中間3層・ボイド対象）";
    document.getElementById("thOuterDesc").textContent = "第1・7層 [%] 入力";
    document.getElementById("thWeakDesc").textContent = "第2・4・6層 [%] 入力";
    document.getElementById("thInnerDesc").textContent = "第3・5層 [%] 入力";
    document.getElementById("uFormulaText").innerHTML =
      "<strong>7層構成 U値：</strong> <code>U = 1 / { (Ri + Ro) + 2d/λ(強軸:最外層) + 3d/λ(弱軸) + 2d/λ(強軸:内層) }</code>";
  } else {
    document.getElementById("legendStrongText").textContent = "第1・3・5層（最外層2層＋内層1層）";
    document.getElementById("legendWeakText").textContent = "第2・4層（中間2層・ボイド対象）";
    document.getElementById("thOuterDesc").textContent = "第1・5層 [%] 入力";
    document.getElementById("thWeakDesc").textContent = "第2・4層 [%] 入力";
    document.getElementById("thInnerDesc").textContent = "第3層 [%] 入力";
    document.getElementById("uFormulaText").innerHTML =
      "<strong>5層構成 U値：</strong> <code>U = 1 / { (Ri + Ro) + 2d/λ(強軸:最外層) + 2d/λ(弱軸) + 1d/λ(強軸:内層) }</code>";
  }
}

// Render Table
function renderTable() {
  const tbody = document.getElementById("simTableBody");
  tbody.innerHTML = "";

  const solidBase = calcUValue(0, 0, 0, state.layers, state.params).uValue;

  state.candidates.forEach((cand, idx) => {
    const res = calcUValue(cand.outer, cand.weak, cand.inner, state.layers, state.params);
    const tr = document.createElement("tr");
    if (idx === state.selectedIndex) {
      tr.classList.add("selected-row");
    }

    tr.addEventListener("click", (e) => {
      if (e.target.closest("button")) return;
      if (state.selectedIndex !== idx) {
        state.selectedIndex = idx;
        saveState();
        updateSelectedHighlight();
        renderPreview();
      }
    });

    // Reduction badge
    let diffHtml = "—";
    if (res.uValue !== null && solidBase !== null && solidBase > 0) {
      const pctChange = ((res.uValue - solidBase) / solidBase) * 100;
      const cls = pctChange < -0.05 ? "good" : "neutral";
      const sign = pctChange > 0 ? "+" : "";
      diffHtml = `<span class="badge-reduction ${cls}">${sign}${pctChange.toFixed(1)}%</span>`;
    }

    tr.innerHTML = `
      <td class="cell-no">
        <label class="row-radio-wrap">
          <input type="radio" name="selectedCandidate" ${idx === state.selectedIndex ? "checked" : ""}>
          <span>${getCandidateLabel(idx)}</span>
        </label>
      </td>
      <td>
        <input type="text" class="input-memo" placeholder="例: 弱軸40%" value="${escapeHtml(cand.memo || "")}" data-idx="${idx}" data-field="memo">
      </td>
      <td>
        <input type="number" class="input-porosity" min="0" max="100" step="0.1" placeholder="0"
               value="${cand.outer !== null && cand.outer !== "" ? cand.outer : ""}" data-idx="${idx}" data-field="outer">
      </td>
      <td>
        <input type="number" class="input-porosity" min="0" max="100" step="0.1" placeholder="0"
               value="${cand.weak !== null && cand.weak !== "" ? cand.weak : ""}" data-idx="${idx}" data-field="weak">
      </td>
      <td>
        <input type="number" class="input-porosity" min="0" max="100" step="0.1" placeholder="0"
               value="${cand.inner !== null && cand.inner !== "" ? cand.inner : ""}" data-idx="${idx}" data-field="inner">
      </td>
      <td class="cell-calc">${res.lOut !== null ? res.lOut.toFixed(5) : "—"}</td>
      <td class="cell-calc">${res.lWeak !== null ? res.lWeak.toFixed(5) : "—"}</td>
      <td class="cell-calc">${res.lIn !== null ? res.lIn.toFixed(5) : "—"}</td>
      <td class="cell-result">${res.uValue !== null ? res.uValue.toFixed(4) : "—"}</td>
      <td class="cell-diff">${diffHtml}</td>
      <td>
        <button type="button" class="btn-del-row" data-del="${idx}" title="この行を削除" ${state.candidates.length <= 1 ? "disabled" : ""}>✕</button>
      </td>
    `;

    tbody.appendChild(tr);
  });

  // Attach input listeners
  tbody.querySelectorAll(".input-porosity").forEach((inp) => {
    inp.addEventListener("input", (e) => {
      const idx = Number(e.target.dataset.idx);
      const field = e.target.dataset.field;
      const val = e.target.value === "" ? null : Number(e.target.value);
      state.candidates[idx][field] = val;
      state.selectedIndex = idx;
      saveState();
      updateRowCells(idx);
      updateSelectedHighlight();
      renderPreview();
    });
  });

  tbody.querySelectorAll(".input-memo").forEach((inp) => {
    inp.addEventListener("input", (e) => {
      const idx = Number(e.target.dataset.idx);
      state.candidates[idx].memo = e.target.value;
      saveState();
      if (idx === state.selectedIndex) {
        renderPreview();
      }
    });
  });

  tbody.querySelectorAll(".btn-del-row").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const idx = Number(e.target.dataset.del);
      if (state.candidates.length <= 1) return;
      state.candidates.splice(idx, 1);
      if (state.selectedIndex >= state.candidates.length) {
        state.selectedIndex = state.candidates.length - 1;
      }
      saveState();
      renderTable();
      renderPreview();
    });
  });
}

function updateRowCells(idx) {
  const tbody = document.getElementById("simTableBody");
  const tr = tbody.children[idx];
  if (!tr) return;

  const cand = state.candidates[idx];
  const res = calcUValue(cand.outer, cand.weak, cand.inner, state.layers, state.params);
  const solidBase = calcUValue(0, 0, 0, state.layers, state.params).uValue;

  const tds = tr.querySelectorAll("td");
  tds[5].textContent = res.lOut !== null ? res.lOut.toFixed(5) : "—";
  tds[6].textContent = res.lWeak !== null ? res.lWeak.toFixed(5) : "—";
  tds[7].textContent = res.lIn !== null ? res.lIn.toFixed(5) : "—";
  tds[8].textContent = res.uValue !== null ? res.uValue.toFixed(4) : "—";

  if (res.uValue !== null && solidBase !== null && solidBase > 0) {
    const pctChange = ((res.uValue - solidBase) / solidBase) * 100;
    const cls = pctChange < -0.05 ? "good" : "neutral";
    const sign = pctChange > 0 ? "+" : "";
    tds[9].innerHTML = `<span class="badge-reduction ${cls}">${sign}${pctChange.toFixed(1)}%</span>`;
  } else {
    tds[9].textContent = "—";
  }
}

function updateSelectedHighlight() {
  const tbody = document.getElementById("simTableBody");
  Array.from(tbody.children).forEach((tr, i) => {
    tr.classList.toggle("selected-row", i === state.selectedIndex);
    const radio = tr.querySelector('input[type="radio"]');
    if (radio) radio.checked = i === state.selectedIndex;
  });
}

// Render Interactive SVG Cross-Section & KPIs
function renderPreview() {
  const idx = state.selectedIndex;
  const cand = state.candidates[idx] || state.candidates[0];
  const res = calcUValue(cand.outer, cand.weak, cand.inner, state.layers, state.params);
  const solidBase = calcUValue(0, 0, 0, state.layers, state.params).uValue;

  const label = getCandidateLabel(idx);
  const memoText = cand.memo ? `（${cand.memo}）` : "";
  document.getElementById("activeCandidateBadge").textContent = `候補 ${label}${memoText}`;

  // Update KPIs
  document.getElementById("kpiUValue").textContent = res.uValue !== null ? res.uValue.toFixed(4) : "—";
  document.getElementById("kpiRValue").textContent = res.rTotal !== null ? res.rTotal.toFixed(4) : "—";
  document.getElementById("kpiBaseRef").textContent =
    solidBase !== null ? `基準(全層0%): ${solidBase.toFixed(4)}` : "基準(全層0%): —";

  if (res.uValue !== null && solidBase !== null && solidBase > 0) {
    const pct = ((res.uValue - solidBase) / solidBase) * 100;
    const sign = pct > 0 ? "+" : "";
    document.getElementById("kpiReduction").textContent = `${sign}${pct.toFixed(1)}%`;
  } else {
    document.getElementById("kpiReduction").textContent = "—";
  }

  // Build SVG cross-section
  const N = state.layers;
  const svgW = 420;
  const svgH = N === 7 ? 248 : 210;
  const padX = 16;
  const padY = 14;
  const blockX = 110;
  const blockW = 190;
  const gap = 4;
  const layerH = (svgH - padY * 2 - gap * (N - 1)) / N;
  const dMm = Math.round(state.params.thickness * 1000);

  let svgParts = [
    `<svg viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="CLT ${N}層断面図">`
  ];

  for (let i = 0; i < N; i++) {
    const layerNum = i + 1;
    const y = padY + i * (layerH + gap);
    const isStrong = layerNum % 2 === 1;
    const isOuter = layerNum === 1 || layerNum === N;

    let roleName = "";
    let porosity = null;
    let lam = null;

    if (isOuter) {
      roleName = `第${layerNum}層 強軸(最外)`;
      porosity = cand.outer;
      lam = res.lOut;
    } else if (!isStrong) {
      roleName = `第${layerNum}層 弱軸`;
      porosity = cand.weak;
      lam = res.lWeak;
    } else {
      roleName = `第${layerNum}層 強軸(内層)`;
      porosity = cand.inner;
      lam = res.lIn;
    }

    const fill = isStrong ? "#E8B878" : "#BA7E44";
    const stroke = isStrong ? "#C6924E" : "#8F5B28";

    // Left label
    svgParts.push(
      `<text x="${blockX - 8}" y="${y + layerH / 2 + 4}" text-anchor="end" font-size="11" font-weight="600" fill="#2D3748">${roleName}</text>`
    );

    // Layer rectangle
    svgParts.push(
      `<rect x="${blockX}" y="${y}" width="${blockW}" height="${layerH}" rx="4" fill="${fill}" stroke="${stroke}" stroke-width="1.2"/>`
    );

    // Visual voids or grain lines
    const pVal = porosity !== null && porosity !== "" ? Math.max(0, Math.min(100, Number(porosity))) : 0;
    if (isStrong) {
      // Grain lines
      for (let g = 1; g <= 5; g++) {
        const gx = blockX + (blockW * g) / 6;
        svgParts.push(
          `<line x1="${gx}" y1="${y + 4}" x2="${gx}" y2="${y + layerH - 4}" stroke="#B7791F" stroke-opacity="0.45" stroke-width="1.2"/>`
        );
      }
      if (pVal > 0) {
        // Subtle void indicator for strong-axis voids
        const r = Math.max(2.5, (layerH * 0.26) * Math.sqrt(pVal / 45));
        [0.25, 0.5, 0.75].forEach((pos) => {
          const cx = blockX + blockW * pos;
          const cy = y + layerH / 2;
          svgParts.push(`<circle cx="${cx}" cy="${cy}" r="${r.toFixed(1)}" fill="#18314F" stroke="#63B3ED" stroke-width="1"/>`);
        });
      }
    } else {
      // Weak axis voids
      if (pVal > 0) {
        const r = Math.max(3, (layerH * 0.34) * Math.sqrt(pVal / 45));
        [0.22, 0.5, 0.78].forEach((pos) => {
          const cx = blockX + blockW * pos;
          const cy = y + layerH / 2;
          svgParts.push(`<circle cx="${cx}" cy="${cy}" r="${r.toFixed(1)}" fill="#18314F" stroke="#63B3ED" stroke-width="1.4"/>`);
        });
      } else {
        svgParts.push(
          `<line x1="${blockX + 10}" y1="${y + layerH / 2}" x2="${blockX + blockW - 10}" y2="${y + layerH / 2}" stroke="#744210" stroke-opacity="0.35" stroke-dasharray="4 3" stroke-width="1.2"/>`
        );
      }
    }

    // Center porosity text pill
    const pText = porosity !== null && porosity !== "" ? `${Number(porosity)}%` : "未入力";
    svgParts.push(
      `<rect x="${blockX + blockW / 2 - 24}" y="${y + layerH / 2 - 8}" width="48" height="16" rx="8" fill="rgba(255,255,255,0.88)"/>`
    );
    svgParts.push(
      `<text x="${blockX + blockW / 2}" y="${y + layerH / 2 + 4}" text-anchor="middle" font-size="10" font-weight="700" fill="#1A202C">${pText}</text>`
    );

    // Right label: lambda & thickness
    const lamText = lam !== null ? `λ=${lam.toFixed(4)}` : "λ=—";
    svgParts.push(
      `<text x="${blockX + blockW + 8}" y="${y + layerH / 2 + 4}" text-anchor="start" font-size="10.5" font-family="monospace" fill="#4A5568">${lamText} (${dMm}mm)</text>`
    );
  }

  svgParts.push("</svg>");
  document.getElementById("cltDiagramContainer").innerHTML = svgParts.join("");
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Export CSV (UTF-8 with BOM for Excel)
function exportCsv() {
  const solidBase = calcUValue(0, 0, 0, state.layers, state.params).uValue;
  const headers = [
    "層数",
    "候補",
    "メモ",
    "開口率_強軸最外層[%]",
    "開口率_弱軸[%]",
    "開口率_強軸内層[%]",
    "熱伝導率λ_強軸最外層[W/mK]",
    "熱伝導率λ_弱軸[W/mK]",
    "熱伝導率λ_強軸内層[W/mK]",
    "総熱抵抗Rtotal[m2K/W]",
    "U値理論値[W/m2K]",
    "無垢CLT比U値変化率[%]"
  ];

  const rows = state.candidates.map((cand, idx) => {
    const res = calcUValue(cand.outer, cand.weak, cand.inner, state.layers, state.params);
    let pctStr = "";
    if (res.uValue !== null && solidBase !== null && solidBase > 0) {
      pctStr = (((res.uValue - solidBase) / solidBase) * 100).toFixed(2);
    }
    return [
      `${state.layers}層`,
      getCandidateLabel(idx),
      `"${(cand.memo || "").replace(/"/g, '""')}"`,
      cand.outer ?? "",
      cand.weak ?? "",
      cand.inner ?? "",
      res.lOut !== null ? res.lOut.toFixed(5) : "",
      res.lWeak !== null ? res.lWeak.toFixed(5) : "",
      res.lIn !== null ? res.lIn.toFixed(5) : "",
      res.rTotal !== null ? res.rTotal.toFixed(4) : "",
      res.uValue !== null ? res.uValue.toFixed(4) : "",
      pctStr
    ].join(",");
  });

  const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `CLT_${state.layers}層_U値理論値シミュレーション.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Initialize events
function init() {
  loadState();
  syncParamInputs();
  updateLayerModeUI();
  renderTable();
  renderPreview();

  // Mode buttons
  document.getElementById("btnMode5").addEventListener("click", () => {
    state.layers = 5;
    saveState();
    updateLayerModeUI();
    renderTable();
    renderPreview();
  });

  document.getElementById("btnMode7").addEventListener("click", () => {
    state.layers = 7;
    saveState();
    updateLayerModeUI();
    renderTable();
    renderPreview();
  });

  // Parameter inputs
  const paramMap = [
    ["paramSlope", "slope"],
    ["paramIntercept", "intercept"],
    ["paramRi", "ri"],
    ["paramRo", "ro"],
    ["paramThickness", "thickness"]
  ];

  paramMap.forEach(([elId, key]) => {
    document.getElementById(elId).addEventListener("input", (e) => {
      const val = Number(e.target.value);
      if (!Number.isNaN(val)) {
        state.params[key] = val;
        saveState();
        updateSurfaceDisplay();
        updateLayerModeUI();
        renderTable();
        renderPreview();
      }
    });
  });

  document.getElementById("btnResetParams").addEventListener("click", () => {
    state.params = { ...DEFAULT_PARAMS };
    saveState();
    syncParamInputs();
    updateLayerModeUI();
    renderTable();
    renderPreview();
  });

  // Table toolbar actions
  document.getElementById("btnLoadPresets").addEventListener("click", () => {
    state.candidates = PRESET_CANDIDATES.map((p) => ({ ...p }));
    state.selectedIndex = 1; // Select 弱軸のみ40%ボイド for visual impact
    saveState();
    renderTable();
    renderPreview();
  });

  document.getElementById("btnAddRow").addEventListener("click", () => {
    state.candidates.push({ memo: "", outer: null, weak: null, inner: null });
    state.selectedIndex = state.candidates.length - 1;
    saveState();
    renderTable();
    renderPreview();
  });

  document.getElementById("btnClearAll").addEventListener("click", () => {
    state.candidates = [
      { memo: "", outer: null, weak: null, inner: null },
      { memo: "", outer: null, weak: null, inner: null },
      { memo: "", outer: null, weak: null, inner: null },
      { memo: "", outer: null, weak: null, inner: null },
      { memo: "", outer: null, weak: null, inner: null }
    ];
    state.selectedIndex = 0;
    saveState();
    renderTable();
    renderPreview();
  });

  document.getElementById("btnExportCsv").addEventListener("click", exportCsv);

  // Register Service Worker for offline PWA capability
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch((err) => {
      console.warn("SW registration skipped:", err);
    });
  }
}

document.addEventListener("DOMContentLoaded", init);
