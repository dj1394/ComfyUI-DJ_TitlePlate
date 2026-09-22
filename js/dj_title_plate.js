import { app } from "/scripts/app.js";

// ── 双击编辑：视口换算（照抄小竹光，Vue 版 ComfyUI 下最稳）──
function getNodeViewportRect(node) {
  const cv = (window.app && window.app.canvas) || LGraphCanvas.active_canvas;
  if (!cv?.canvas?.isConnected) return null;
  try {
    const rect = cv.canvas.getBoundingClientRect();
    const scale = Number(cv.ds?.scale) || 1;
    return { left: rect.left, top: rect.top, scale };
  } catch (e) {
    return null;
  }
}

// ── 双击编辑：Vue DOM 层捕获绑定（LiteGraph 的 onDblClick 在 Vue 渲染下不触发）──
function attachVueDblClick(node) {
  if (node._vueDblBound) return;
  node._vueDblBound = true;
  let tries = 0;
  const timer = setInterval(() => {
    if (!node._vueDblBound || ++tries > 20) {
      clearInterval(timer);
      return;
    }
    if (node._removed) {
      node._vueDblBound = false;
      clearInterval(timer);
      return;
    }
    const el =
      document.querySelector(`.litegraph-node[data-node-id="${node.id}"]`) ||
      document.querySelector(`[data-node-id="${node.id}"]`);
    if (!el) return;
    node._vueDblEl = el;
    const handler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (node.isEditing) return;
      fontBar.close();
      createTitleEditor(node);
    };
    el.addEventListener("dblclick", handler, true);
    node._vueDblHandler = handler;
    clearInterval(timer);
  }, 100);
}

function detachVueDblClick(node) {
  if (!node._vueDblEl) {
    node._vueDblBound = false;
    return;
  }
  if (node._vueDblHandler) node._vueDblEl.removeEventListener("dblclick", node._vueDblHandler, true);
  node._vueDblEl = null;
  node._vueDblHandler = null;
  node._vueDblBound = false;
}

// ── 双击编辑：创建 / 提交 / 移除（核心抄小竹光，去掉工具条）──
function createTitleEditor(node) {
  if (node.editTextarea) removeTitleEditor(node);
  const vr = getNodeViewportRect(node);
  if (!vr) return;
  const sc = Math.max(0.2, vr.scale);

  const fontSize = Math.max(node.properties.fontSize || 1, 1);
  const fontFamily = node.properties.fontFamily ?? "Arial";
  const padding = Number(node.properties.padding) ?? 0;
  const fontColor = node.properties.fontColor || "#ffffff";
  const align = node.properties.textAlign || "left";
  const letterSpacing = Number(node.properties.letterSpacing) || 0;

  // 选中高亮样式（只注入一次）
  if (!document.getElementById("dj-title-edit-selection-style")) {
    const s = document.createElement("style");
    s.id = "dj-title-edit-selection-style";
    s.textContent =
      "[data-dj-title-edit] textarea::selection,[data-dj-title-edit] textarea::-moz-selection{color:#fff!important;background:#4a9eff!important;}";
    document.head.appendChild(s);
  }

  const cv0 = (window.app && window.app.canvas) || LGraphCanvas.active_canvas;
  const ds0 = cv0?.ds ?? {};
  const ox0 = Number(ds0.offset?.[0]) || 0;
  const oy0 = Number(ds0.offset?.[1]) || 0;

  const container = document.createElement("div");
  container.dataset.djTitleEdit = String(node.id);
  container.style.cssText = `position:fixed;left:${vr.left + (node.pos[0] + ox0) * sc}px;top:${vr.top + (node.pos[1] + oy0) * sc}px;width:${Math.max(60, node.size[0] * sc)}px;z-index:100000;border:none;outline:none;background:transparent;box-shadow:none;`;
  container.addEventListener("contextmenu", (e) => { e.preventDefault(); e.stopPropagation(); }, false);

  // 滚轮转发给画布（在面板空白处滚动 = 缩放画布）
  container.addEventListener("wheel", (e) => {
    if (e.target === ta) return;
    const cv = (window.app && window.app.canvas) || LGraphCanvas.active_canvas;
    if (!cv?.canvas) return;
    e.preventDefault();
    e.stopPropagation();
    cv.canvas.dispatchEvent(new WheelEvent("wheel", {
      deltaY: e.deltaY, deltaX: e.deltaX,
      clientX: e.clientX, clientY: e.clientY,
      ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, altKey: e.altKey,
      bubbles: true, cancelable: true,
    }));
  }, { capture: true, passive: false });

  // 透明文字 textarea：只负责输入与光标定位，视觉由画布渲染
  const ta = document.createElement("textarea");
  ta.value = node.getText();
  ta.spellcheck = false;
  // 算文字实际宽度，让 textarea 贴合内容（含字距）
  const _mCtx = document.createElement("canvas").getContext("2d");
  _mCtx.font = `${Math.max(fontSize, 1) * sc}px ${fontFamily}`;
  if ("letterSpacing" in _mCtx) _mCtx.letterSpacing = `${letterSpacing * sc}px`;
  const _lines = node.getText().split("\n");
  let _maxW = 0;
  for (const _l of _lines) { if (_mCtx.measureText(_l || " ").width > _maxW) _maxW = _mCtx.measureText(_l || " ").width; }
  const _taW = Math.max(40, _maxW + (padding * sc) * 2 + 4);

  ta.style.cssText = [
    "all:unset;",
    "box-sizing:border-box;",
    `width:${_taW}px;`,
    `height:${Math.max(30, node.size[1] * sc)}px`,
    `padding:${padding * sc}px;`,
    "background:transparent;",
    "border:1px dashed rgba(0,255,0,0.4);",
    "color:transparent;-webkit-text-fill-color:transparent;",
    `caret-color:${fontColor === "#ffffff" ? "#00ff6a" : fontColor};`,
    `text-align:${align};`,
    `letter-spacing:${letterSpacing * sc}px;`,
    `font: ${fontSize * sc}px ${fontFamily};`,
    `line-height:${1.3 * fontSize * sc}px;`,
    "overflow:hidden;white-space:pre-wrap;word-break:break-all;position:relative;",
  ].join("");

  container.appendChild(ta);


  node.editTextarea = container;
  node._editTaEl = ta;
  node.isEditing = true;
  // 强制关掉字号横条（防止它浮在编辑器上方）
  fontBar.close();
  if (fontBar.panel) fontBar.panel.style.display = "none";
  // 给 Vue DOM 层节点 wrapper 打标记，CSS 据此消除边框
  if (node._vueDblEl) node._vueDblEl.setAttribute("data-dj-title-editing", "true");
  document.body.appendChild(container);

  // 进入编辑直接输入，光标定位到开头
  requestAnimationFrame(() => {
    ta.focus({ preventScroll: true });
    ta.setSelectionRange(1, 1);
  });

  // rAF 跟位：缩放/平移时编辑器始终贴在节点上
  const posTick = () => {
    if (!node.editTextarea) { node._posRaf = null; return; }
    const nr = getNodeViewportRect(node);
    if (nr) {
      const s = Math.max(0.2, nr.scale);
      // 节点左上角（画布坐标 pos）→ 窗口坐标：rect + (pos + offset) * scale
      const cv = (window.app && window.app.canvas) || LGraphCanvas.active_canvas;
      const ds = cv?.ds ?? {};
      const ox = Number(ds.offset?.[0]) || 0;
      const oy = Number(ds.offset?.[1]) || 0;
      container.style.left = `${nr.left + (node.pos[0] + ox) * s}px`;
      container.style.top = `${nr.top + (node.pos[1] + oy) * s}px`;
      container.style.width = `${Math.max(60, node.size[0] * s)}px`;
      ta.style.height = `${Math.max(30, node.size[1] * s)}px`;
      ta.style.fontSize = `${fontSize * s}px`;
      ta.style.lineHeight = `${1.3 * fontSize * s}px`;
    }
    node._posRaf = requestAnimationFrame(posTick);
  };
  node._posRaf = requestAnimationFrame(posTick);

  const saveClose = () => {
    if (!node.editTextarea) return;
    node.title = ta.value.replace(/\n/g, "\\n");
    removeTitleEditor(node);
    node.setDirtyCanvas?.(true, true);
    window.app?.graph?.setDirtyCanvas(true);
  };

  // 输入实时写回，画布同步显示（尺寸随之变化）
  ta.addEventListener("input", () => {
    node.title = ta.value.replace(/\n/g, "\\n");
    const cv = (window.app && window.app.canvas) || LGraphCanvas.active_canvas;
    cv?.graph?.setDirtyCanvas(true);
  });

  ta.addEventListener("compositionstart", () => { node._composing = true; });
  ta.addEventListener("compositionend", () => { node._composing = false; });
  ta.addEventListener("contextmenu", (e) => { e.preventDefault(); e.stopPropagation(); }, false);
  ta.addEventListener("keydown", (e) => {
    if (e.key === "Escape") removeTitleEditor(node);
    else if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveClose(); }
    else if (e.key === "Enter" && e.shiftKey) { /* 允许换行 */ }
    e.stopPropagation();
  });

  // 点画布空白处：保存并关闭（点在编辑器内不关）
  node._docMouseDown = (e) => {
    if (!node.isEditing || !node.editTextarea) return;
    let el = e.target;
    node._mouseDownInEditor = false;
    while (el) {
      if (el === container) { node._mouseDownInEditor = true; break; }
      el = el.parentElement;
    }
  };
  node._docClickHandler = (e) => {
    if (!node.isEditing || !node.editTextarea) return;
    if (node._mouseDownInEditor) { node._mouseDownInEditor = false; return; }
    let el = e.target;
    while (el) {
      if (el === container) return;
      el = el.parentElement;
    }
    saveClose();
  };
  setTimeout(() => {
    if (node.isEditing) {
      document.addEventListener("click", node._docClickHandler, true);
      document.addEventListener("mousedown", node._docMouseDown, true);
    }
  }, 200);

  // 失焦兜底：焦点被抢走时拉回来；若跑到了别的节点 DOM 上则保存关闭
  let focusTries = 0;
  const focusTick = () => {
    if (!node.editTextarea || node._removed) { node._focusGuard = null; return; }
    if (node._composing) { node._focusGuard = requestAnimationFrame(focusTick); return; }
    const ae = document.activeElement;
    if (ae !== ta) {
      if (++focusTries > 8) { saveClose(); return; }
      const onOtherNode = ae && ae.closest?.('[data-node-id]') && !container.contains(ae);
      if (onOtherNode) { saveClose(); return; }
      ta.focus({ preventScroll: true });
    } else {
      focusTries = 0;
    }
    node._focusGuard = requestAnimationFrame(focusTick);
  };
  node._focusGuard = requestAnimationFrame(focusTick);
}

function removeTitleEditor(node) {
  if (node._focusGuard) { cancelAnimationFrame(node._focusGuard); node._focusGuard = null; }
  if (node._posRaf) { cancelAnimationFrame(node._posRaf); node._posRaf = null; }
  if (node._docClickHandler) { document.removeEventListener("click", node._docClickHandler, true); node._docClickHandler = null; }
  if (node._docMouseDown) { document.removeEventListener("mousedown", node._docMouseDown, true); node._docMouseDown = null; }
  if (node.editTextarea) { node.editTextarea.remove(); node.editTextarea = null; }
  // 去掉编辑标记
  if (node._vueDblEl) node._vueDblEl.removeAttribute("data-dj-title-editing");
  node._editTaEl = null;
  node.isEditing = false;
  // 确保横条状态干净
  fontBar.close();
}

// ── CSS 注入 ──────────────────────────────────────────────
const style = document.createElement("style");
style.textContent = `
  /* 默认隐藏虚框（showBorder=false）：外层 + 所有子元素 */
  .litegraph-node[data-dj-noborder="true"],
  .litegraph-node[data-dj-noborder="true"] * {
    border: none !important;
    outline: none !important;
    box-shadow: none !important;
  }
  /* 编辑状态下：容器、textarea、以及任何 DOM 层边框全部干掉 */
  [data-dj-title-edit],
  [data-dj-title-edit] *,
  [data-dj-title-edit] textarea,
  [data-dj-title-edit] div {
    border: none !important;
    outline: none !important;
    box-shadow: none !important;
    -webkit-appearance: none;
    appearance: none;
  }

  .dj-title-plate-help-dialog {
    outline: 0;
    border: 0;
    border-radius: 6px;
    background: #414141;
    color: #fff;
    box-shadow: inset 1px 1px 0px rgba(255,255,255,0.05),
                inset -1px -1px 0px rgba(0,0,0,0.5),
                2px 2px 20px rgb(0,0,0);
    max-width: 800px;
    box-sizing: border-box;
    font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
    font-size: 1rem;
    padding: 0;
    max-height: calc(100% - 32px);
  }
  .dj-title-plate-help-dialog * { box-sizing: inherit; }
  .dj-title-plate-help-dialog > div { padding: 16px; }
  .dj-title-plate-help-dialog h2 { font-size: 1.375rem; margin: 0 0 8px; font-weight: bold; }
  .dj-title-plate-help-dialog h2 small { font-size: 0.8125rem; font-weight: normal; opacity: 0.75; }
  .dj-title-plate-help-dialog p { font-size: 0.8125rem; margin-top: 0; }
  .dj-title-plate-help-dialog ul li p { margin-bottom: 4px; }
  .dj-title-plate-help-dialog ul li p + p { margin-top: 0.5em; }
  .dj-title-plate-help-dialog footer {
    display: flex; align-items: center; justify-content: center; padding: 8px 16px 16px;
  }
  .dj-title-plate-help-dialog footer button {
    cursor: pointer; border: 0; border-radius: 0.33rem;
    background: #212121; color: white;
    font-family: system-ui, sans-serif; font-size: 1rem; line-height: 1;
    padding: 7px 16px 9px; margin: 0.25rem;
    box-shadow: 0px 0px 2px rgb(0,0,0);
    transition: all 0.1s ease-in-out;
  }
  .dj-title-plate-help-dialog footer button:hover { background: #303030; }
  body.dj-title-plate-dialog-open > *:not(.dj-title-plate-help-dialog) {
    filter: blur(5px);
  }
`;

// ── 字号/字距横条常量（与 DJ_GroupTitle 一致）──────────────
const MIN_FONT_SIZE = 12;
const MAX_FONT_SIZE = 300;
const FONT_SLIDER_PIXELS_PER_STEP = 2; // 拖动速率：每 2 屏幕像素 = 1 号字
const FONT_SLIDER_VISUAL_MAX = 96;     // 滑块填充视觉上限（超过后不再变长）
const MIN_LETTER_SPACING = -10;        // 字距范围 px
const MAX_LETTER_SPACING = 50;
const LETTER_SLIDER_PIXELS_PER_STEP = 2; // 每 2 屏幕像素 = 1px 字距
const LETTER_SLIDER_VISUAL_MAX = 20;    // 滑块填充视觉上限（超过后不再变长）
const FONT_BAR_WIDTH = 236;            // 横条宽度

// ── 字号横条（点击标签下方弹出，拖动改字号）───────────────
const fontBar = {
  panel: null,
  sliderFill: null,
  numberInput: null,
  letterFill: null,
  letterInput: null,
  anchorNode: null,
  drag: null,
  frameHandle: 0,

  clampSize(value) {
    const n = Number(value);
    return Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, Math.round(Number.isFinite(n) ? n : 32)));
  },

  clampSpacing(value) {
    const n = Number(value);
    return Math.max(MIN_LETTER_SPACING, Math.min(MAX_LETTER_SPACING, Math.round(Number.isFinite(n) ? n : 0)));
  },

  setFontSize(size) {
    const node = this.anchorNode;
    if (!node) return;
    const s = this.clampSize(size);
    if (Number(node.properties.fontSize) === s) {
      this.syncSlider(s);
      return;
    }
    node.properties.fontSize = s;
    node.setDirtyCanvas?.(true, true);
    const canvas = LGraphCanvas.active_canvas;
    canvas?.setDirty?.(true, true);
    this.syncSlider(s);
  },

  setLetterSpacing(spacing) {
    const node = this.anchorNode;
    if (!node) return;
    const s = this.clampSpacing(spacing);
    if (Number(node.properties.letterSpacing) === s) {
      this.syncLetterSlider(s);
      return;
    }
    node.properties.letterSpacing = s;
    node.setDirtyCanvas?.(true, true);
    const canvas = LGraphCanvas.active_canvas;
    canvas?.setDirty?.(true, true);
    this.syncLetterSlider(s);
  },

  syncSlider(size) {
    const s = this.clampSize(size);
    if (this.sliderFill) {
      // 对数映射：小字号区间拖动更灵敏，大字号区间更稳。
      // 12→0%，32≈44%，96→100%，超过 96 后填充不再变长（数值仍继续涨）。
      const logMin = Math.log(MIN_FONT_SIZE);
      const logMax = Math.log(FONT_SLIDER_VISUAL_MAX);
      const ratio = (Math.log(s) - logMin) / (logMax - logMin);
      this.sliderFill.style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
    }
    if (this.numberInput && document.activeElement !== this.numberInput) {
      this.numberInput.value = String(s);
    }
  },

  syncLetterSlider(spacing) {
    const s = this.clampSpacing(spacing);
    if (this.letterFill) {
      // 线性映射：-10→0%，0→20%，20→100%（视觉上限），超过后填充不再变长
      const ratio = (s - MIN_LETTER_SPACING) / (LETTER_SLIDER_VISUAL_MAX - MIN_LETTER_SPACING);
      this.letterFill.style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
    }
    if (this.letterInput && document.activeElement !== this.letterInput) {
      this.letterInput.value = String(s);
    }
  },

  // 锚定在标签下方，跟随缩放/平移（每帧重算）。
  // 坐标算法与 DJ_GroupTitle 一致：convertOffsetToCanvas 得到画布元素内部像素，
  // 再叠加 getBoundingClientRect() 的页面偏移，才是 fixed 定位需要的窗口坐标。
  positionPanel() {
    const node = this.anchorNode;
    const canvas = LGraphCanvas.active_canvas;
    if (!this.panel || !node?.pos || !canvas?.canvas?.isConnected) return;

    let localX, localY;
    try {
      if (typeof canvas.convertOffsetToCanvas === "function") {
        const converted = canvas.convertOffsetToCanvas([
          Number(node.pos[0]) || 0,
          ((Number(node.pos[1]) || 0) + (Number(node.size?.[1]) || 0)) + 12, // 标签下沿再往下 12px
        ]);
        if (Array.isArray(converted)) {
          localX = converted[0];
          localY = converted[1];
        }
      }
      if (localX === undefined || localY === undefined) {
        // 兜底：直接用画布缩放/偏移状态手算
        const ds = canvas.ds ?? {};
        const scale = Number(ds.scale) || 1;
        const offsetX = Number(ds.offset?.[0]) || 0;
        const offsetY = Number(ds.offset?.[1]) || 0;
        localX = ((Number(node.pos[0]) || 0) + offsetX) * scale;
        localY = (((Number(node.pos[1]) || 0) + (Number(node.size?.[1]) || 0) + 12) + offsetY) * scale;
      }
    } catch (e) {
      console.warn("[DJ_TitlePlate] 横条定位异常", e);
      return;
    }

    const rect = canvas.canvas.getBoundingClientRect();
    const width = this.panel.offsetWidth || FONT_BAR_WIDTH;
    const height = this.panel.offsetHeight || 34;
    const maxTop = Math.max(8, window.innerHeight - height - 8);
    const left = Math.min(
      Math.max(8, rect.left + localX),
      Math.max(8, window.innerWidth - width - 8),
    );
    // 横条顶边贴标签下沿；超出屏幕底部则往上收
    const top = Math.min(Math.max(8, rect.top + localY), maxTop);
    this.panel.style.left = `${Math.round(left)}px`;
    this.panel.style.top = `${Math.round(top)}px`;
  },

  follow() {
    if (!this.anchorNode) {
      this.frameHandle = 0;
      return;
    }
    this.positionPanel();
    this.frameHandle = window.requestAnimationFrame(() => this.follow());
  },

  startFollow() {
    if (this.frameHandle) return;
    this.frameHandle = window.requestAnimationFrame(() => this.follow());
  },

  stopFollow() {
    if (!this.frameHandle) return;
    window.cancelAnimationFrame(this.frameHandle);
    this.frameHandle = 0;
  },

  ensurePanel() {
    if (this.panel?.isConnected) return;

    const panel = document.createElement("div");
    Object.assign(panel.style, {
      position: "fixed",
      zIndex: "100002",
      display: "none",
      flexDirection: "column",
      gap: "6px",
      left: "0px",
      top: "0px",
      width: `${FONT_BAR_WIDTH}px`,
      padding: "7px 8px",
      border: "1px solid rgba(255, 255, 255, 0.16)",
      borderRadius: "6px",
      background: "rgba(31, 34, 42, 0.98)",
      boxShadow: "0 6px 22px rgba(0, 0, 0, 0.45)",
      boxSizing: "border-box",
      font: "12px/1.2 Inter, sans-serif",
    });

    // ── 第一行：字号 ──
    const sizeRow = document.createElement("div");
    Object.assign(sizeRow.style, { display: "flex", alignItems: "center", gap: "8px" });

    const sizeLabel = document.createElement("span");
    sizeLabel.textContent = "字号";
    Object.assign(sizeLabel.style, {
      width: "28px",
      flexShrink: "0",
      color: "rgba(255,255,255,0.75)",
      fontSize: "12px",
    });

    const track = document.createElement("div");
    Object.assign(track.style, {
      position: "relative",
      flex: "1 1 auto",
      height: "18px",
      border: "1px solid rgba(255, 255, 255, 0.14)",
      borderRadius: "9px",
      background: "rgba(255, 255, 255, 0.08)",
      cursor: "ew-resize",
      overflow: "hidden",
      touchAction: "none",
      userSelect: "none",
    });

    const fill = document.createElement("div");
    Object.assign(fill.style, {
      position: "absolute",
      left: "0",
      top: "0",
      bottom: "0",
      width: "0%",
      background: "rgba(110, 231, 183, 0.55)",
    });
    track.appendChild(fill);

    const numberInput = document.createElement("input");
    numberInput.type = "number";
    numberInput.min = String(MIN_FONT_SIZE);
    numberInput.max = String(MAX_FONT_SIZE);
    numberInput.step = "1";
    numberInput.title = "输入字号后回车生效";
    Object.assign(numberInput.style, {
      width: "56px",
      height: "22px",
      padding: "0 4px",
      border: "1px solid rgba(255, 255, 255, 0.20)",
      borderRadius: "4px",
      background: "rgba(0, 0, 0, 0.35)",
      color: "#ffffff",
      font: "12px/1 Inter, sans-serif",
      textAlign: "center",
      boxSizing: "border-box",
    });

    sizeRow.append(sizeLabel, track, numberInput);

    // ── 第二行：字距 ──
    const letterRow = document.createElement("div");
    Object.assign(letterRow.style, { display: "flex", alignItems: "center", gap: "8px" });

    const letterLabel = document.createElement("span");
    letterLabel.textContent = "字距";
    Object.assign(letterLabel.style, {
      width: "28px",
      flexShrink: "0",
      color: "rgba(255,255,255,0.75)",
      fontSize: "12px",
    });

    const letterTrack = document.createElement("div");
    Object.assign(letterTrack.style, {
      position: "relative",
      flex: "1 1 auto",
      height: "18px",
      border: "1px solid rgba(255, 255, 255, 0.14)",
      borderRadius: "9px",
      background: "rgba(255, 255, 255, 0.08)",
      cursor: "ew-resize",
      overflow: "hidden",
      touchAction: "none",
      userSelect: "none",
    });

    const letterFill = document.createElement("div");
    Object.assign(letterFill.style, {
      position: "absolute",
      left: "0",
      top: "0",
      bottom: "0",
      width: "20%", // 默认字距 0 → (-10..20 区间) 20%
      background: "rgba(110, 231, 183, 0.55)",
    });
    letterTrack.appendChild(letterFill);

    const letterInput = document.createElement("input");
    letterInput.type = "number";
    letterInput.min = String(MIN_LETTER_SPACING);
    letterInput.max = String(MAX_LETTER_SPACING);
    letterInput.step = "1";
    letterInput.title = "输入字距后回车生效";
    Object.assign(letterInput.style, {
      width: "56px",
      height: "22px",
      padding: "0 4px",
      border: "1px solid rgba(255, 255, 255, 0.20)",
      borderRadius: "4px",
      background: "rgba(0, 0, 0, 0.35)",
      color: "#ffffff",
      font: "12px/1 Inter, sans-serif",
      textAlign: "center",
      boxSizing: "border-box",
    });

    letterRow.append(letterLabel, letterTrack, letterInput);

    panel.append(sizeRow, letterRow);
    document.body.appendChild(panel);

    this.panel = panel;
    this.sliderFill = fill;
    this.numberInput = numberInput;
    this.letterFill = letterFill;
    this.letterInput = letterInput;

    track.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || !this.anchorNode) return;
      event.preventDefault();
      event.stopPropagation();
      track.setPointerCapture?.(event.pointerId);
      this.drag = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startFontSize: Number(this.anchorNode.properties.fontSize) || 32,
      };
    });

    track.addEventListener("pointermove", (event) => {
      if (!this.drag || event.pointerId !== this.drag.pointerId) return;
      event.preventDefault();
      event.stopPropagation();
      const deltaX = event.clientX - this.drag.startClientX;
      this.setFontSize(this.drag.startFontSize + deltaX / FONT_SLIDER_PIXELS_PER_STEP);
    });

    const finishDrag = (event) => {
      if (!this.drag || event.pointerId !== this.drag.pointerId) return;
      this.drag = null;
    };
    track.addEventListener("pointerup", finishDrag);
    track.addEventListener("pointercancel", finishDrag);

    numberInput.addEventListener("pointerdown", (event) => event.stopPropagation());
    numberInput.addEventListener("keydown", (event) => {
      event.stopPropagation();
      if (event.key === "Enter") {
        event.preventDefault();
        const parsed = Number.parseFloat(numberInput.value);
        if (Number.isFinite(parsed)) this.setFontSize(parsed);
        else this.syncSlider(this.anchorNode?.properties.fontSize);
      } else if (event.key === "Escape") {
        event.preventDefault();
        this.close();
      }
    });
    numberInput.addEventListener("blur", () => {
      if (!this.anchorNode) return;
      const parsed = Number.parseFloat(numberInput.value);
      if (Number.isFinite(parsed)) this.setFontSize(parsed);
    });

    // ── 字距行交互 ──
    letterTrack.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || !this.anchorNode) return;
      event.preventDefault();
      event.stopPropagation();
      letterTrack.setPointerCapture?.(event.pointerId);
      this.drag = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startLetterSpacing: Number(this.anchorNode.properties.letterSpacing) || 0,
        isLetter: true,
      };
    });

    letterTrack.addEventListener("pointermove", (event) => {
      if (!this.drag || !this.drag.isLetter || event.pointerId !== this.drag.pointerId) return;
      event.preventDefault();
      event.stopPropagation();
      const deltaX = event.clientX - this.drag.startClientX;
      this.setLetterSpacing(this.drag.startLetterSpacing + deltaX / LETTER_SLIDER_PIXELS_PER_STEP);
    });

    const finishLetterDrag = (event) => {
      if (!this.drag || !this.drag.isLetter || event.pointerId !== this.drag.pointerId) return;
      this.drag = null;
    };
    letterTrack.addEventListener("pointerup", finishLetterDrag);
    letterTrack.addEventListener("pointercancel", finishLetterDrag);

    letterInput.addEventListener("pointerdown", (event) => event.stopPropagation());
    letterInput.addEventListener("keydown", (event) => {
      event.stopPropagation();
      if (event.key === "Enter") {
        event.preventDefault();
        const parsed = Number.parseFloat(letterInput.value);
        if (Number.isFinite(parsed)) this.setLetterSpacing(parsed);
        else this.syncLetterSlider(this.anchorNode?.properties.letterSpacing);
      } else if (event.key === "Escape") {
        event.preventDefault();
        this.close();
      }
    });
    letterInput.addEventListener("blur", () => {
      if (!this.anchorNode) return;
      const parsed = Number.parseFloat(letterInput.value);
      if (Number.isFinite(parsed)) this.setLetterSpacing(parsed);
    });
  },

  open(node) {
    if (!node) return;
    this.close();
    this.anchorNode = node;
    this.ensurePanel();
    this.drag = null;
    this.syncSlider(node.properties.fontSize);
    this.syncLetterSlider(node.properties.letterSpacing ?? 0);
    node._fontBarOpen = true; // 选中态：文字加 50% 灰色线框
    node.setDirtyCanvas?.(true, true);
    this.panel.style.display = "flex";
    this.positionPanel();
    console.info("[DJ_TitlePlate] 字号横条已弹出，fontSize =", node.properties.fontSize);
    this.startFollow();
  },

  // 清掉选中态线框（关闭时调用）
  clearSelected(node) {
    if (node && node._fontBarOpen) {
      node._fontBarOpen = false;
      node.setDirtyCanvas?.(true, true);
    }
  },

  close() {
    this.clearSelected(this.anchorNode); // 去掉选中态线框
    this.drag = null;
    this.anchorNode = null;
    this.stopFollow();
    if (this._openTimer) { clearTimeout(this._openTimer); this._openTimer = null; }
    if (this.panel) this.panel.style.display = "none";
  },
};

// 窗口级监听：点标签弹横条，双击交给文字编辑，Esc 关闭
window.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  const el = event.target;
  // 点在横条自己身上：不关
  let cur = el;
  while (cur) {
    if (cur === fontBar.panel) return;
    cur = cur.parentElement;
  }
  const graphCanvas = LGraphCanvas.active_canvas;
  let node = null;
  try {
    const point = graphCanvas?.convertEventToCanvasOffset?.(event);
    if (point && graphCanvas?.graph) {
      node = graphCanvas.graph.getNodeOnPos(point[0], point[1]);
    }
  } catch (e) {
    console.warn("[DJ_TitlePlate] 点击命中检测异常", e);
    node = null;
  }
  if (node instanceof DJTitlePlate) {
    // 编辑中：不弹横条（编辑器自己管关闭）
    if (node.isEditing) return;
    // 延迟判定：等 250ms，如果没第二次点击才弹横条（避免双击时先弹再关）
    const last = fontBar._lastClick;
    const isDouble = last && last.node === node && event.timeStamp - last.timeStamp < 400;
    fontBar._lastClick = { node, timeStamp: event.timeStamp };
    if (!isDouble) {
      // 取消上一次延迟（如果是连续点击）
      if (fontBar._openTimer) { clearTimeout(fontBar._openTimer); fontBar._openTimer = null; }
      fontBar._openTimer = setTimeout(() => {
        fontBar._openTimer = null;
        // 再次检查：如果期间进入了编辑状态，不弹
        if (!node.isEditing && !node._removed) {
          fontBar.open(node);
        }
      }, 250);
    }
  } else {
    // 点在别处：关掉横条（点标签之外的任何地方）
    if (fontBar.anchorNode) fontBar.close();
    fontBar._lastClick = null;
  }
}, true);

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && fontBar.anchorNode) fontBar.close();
}, true);

window.addEventListener("blur", () => fontBar.close());

// ── 帮助对话框 ────────────────────────────────────────────
function showHelpDialog(node, content) {
  const dialog = document.createElement("dialog");
  dialog.className = "dj-title-plate-help-dialog";
  const container = document.createElement("div");

  const titleDiv = document.createElement("div");
  const h2 = document.createElement("h2");
  h2.innerHTML = node.title + " <small>by DJ</small>";
  titleDiv.appendChild(h2);

  const contentDiv = document.createElement("div");
  contentDiv.innerHTML = content;

  const footer = document.createElement("footer");
  const btn = document.createElement("button");
  btn.textContent = "关闭";
  btn.onclick = () => { dialog.close(); };
  footer.appendChild(btn);

  container.appendChild(titleDiv);
  container.appendChild(contentDiv);
  container.appendChild(footer);
  dialog.appendChild(container);
  document.body.appendChild(dialog);

  // 点击遮罩关闭
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close();
  });
  dialog.addEventListener("close", () => {
    document.body.classList.remove("dj-title-plate-dialog-open");
    dialog.remove();
  });

  document.body.classList.add("dj-title-plate-dialog-open");
  dialog.showModal();
}

// ── 大江 标题 节点 ────────────────────────────────────────
class DJTitlePlate extends LGraphNode {
  static title = "大江 标题";
  static type = "DJ_TitlePlate";
  static category = "大江";
  static collapsable = false;
  static title_mode = LiteGraph.NO_TITLE;

  constructor(title = DJTitlePlate.title) {
    super(title);
    this.properties = {
      fontSize: 32,
      fontFamily: "Arial",
      fontColor: "#ffffff",
      textAlign: "left",
      backgroundColor: "transparent",
      padding: 0,
      borderRadius: 0,
      angle: 0,
      letterSpacing: 0, // 字距 px
      showBorder: false, // 默认不显示虚框
    };
    this.color = "#fff0";
    this.bgcolor = "#fff0";
    this.resizable = false;
    this.isVirtualNode = true;
    this.widgets = [];
  }

  // 当前文字（支持 \n 换行）
  getText() {
    return (this.title ?? "").replace(/\\n/g, "\n").replace(/\n*$/, "");
  }

  draw(ctx) {
    this.flags = this.flags || {};
    this.flags.allow_interaction = !this.flags.pinned;
    ctx.save();
    this.color = "#fff0";
    this.bgcolor = "#fff0";


    const fontColor = this.properties.fontColor || "#ffffff";
    const backgroundColor = this.properties.backgroundColor || "";
    const fontSize = Math.max(this.properties.fontSize || 0, 1);
    const fontFamily = this.properties.fontFamily ?? "Arial";
    const padding = Number(this.properties.padding) ?? 0;
    const letterSpacing = Number(this.properties.letterSpacing) || 0;

    ctx.font = `${fontSize}px ${fontFamily}`;
    if ("letterSpacing" in ctx) ctx.letterSpacing = `${letterSpacing}px`;

    const lines = this.getText().split("\n");

    const maxWidth = Math.max(20, ...lines.map((s) => ctx.measureText(s).width));
    this.size[0] = maxWidth + padding * 2;
    this.size[1] = fontSize * lines.length * 1.08 + padding * 2;

    // 旋转
    const angleDeg = parseInt(String(this.properties.angle ?? 0)) || 0;
    if (angleDeg) {
      const cx = this.size[0] / 2;
      const cy = this.size[1] / 2;
      ctx.translate(cx, cy);
      ctx.rotate((angleDeg * Math.PI) / 180);
      ctx.translate(-cx, -cy);
    }

    // 背景
    if (backgroundColor && backgroundColor !== "transparent") {
      ctx.beginPath();
      const borderRadius = Number(this.properties.borderRadius) || 0;
      ctx.roundRect(0, 0, this.size[0], this.size[1], [borderRadius]);
      ctx.fillStyle = backgroundColor;
      ctx.fill();
    }

    // 编辑状态：在文字下面画一层淡绿底（5% 透明度）
    if (this.isEditing) {
      ctx.fillStyle = "rgba(0,255,0,0.02)";
      ctx.fillRect(0, 0, this.size[0], this.size[1]);
    }

    // 选中状态（字号横条弹出时）：文字外画 50% 透明度灰色线框
    if (this._fontBarOpen) {
      ctx.strokeStyle = "rgba(128,128,128,0.5)";
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, this.size[0] - 1, this.size[1] - 1);
    }

    // 文字：水平按 textAlign，垂直始终在虚框内居中
    let textX = padding;
    if (this.properties.textAlign === "center") {
      ctx.textAlign = "center";
      textX = this.size[0] / 2;
    } else if (this.properties.textAlign === "right") {
      ctx.textAlign = "right";
      textX = this.size[0] - padding;
    } else {
      ctx.textAlign = "left";
    }

    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = fontColor;

    const lineHeight = fontSize * 1.08;
    // alphabetic 基线 = 字形底部；ascent 调大让文字整体下移
    const ascent = fontSize * 0.925;
    const totalTextH = lineHeight * lines.length;
    let currentY = (this.size[1] - totalTextH) / 2 + ascent;

    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i] || " ", textX, currentY);
      currentY += lineHeight;
    }

    ctx.restore();
  }

  // ── 双击：手动判定（LiteGraph 层，Vue 渲染下主路是 attachVueDblClick）──
  onMouseDown(e, pos) {
    if (this.isEditing) return true;
    if (e.button !== 0) return false;
    const now = Date.now();
    if (this._lastClickTime && now - this._lastClickTime < 300) {
      this._lastClickTime = 0;
      fontBar.close();
      createTitleEditor(this);
      return true;
    }
    this._lastClickTime = now;
    return false;
  }

  onDblClick(event, pos, canvas) {
    if (this.isEditing) return true;
    fontBar.close();
    createTitleEditor(this);
    return true;
  }

  // 同步虚框显示状态（canvas 层面，draw 里处理）
  _syncBorderVisibility() {
    this.setDirtyCanvas?.(true, true);
  }

  // 上屏后绑 Vue DOM 层 dblclick（主路）+ 虚框状态
  onNodeCreated() {
    attachVueDblClick(this);
    // 轮询等 Vue DOM 渲染完再同步虚框状态
    let tries = 0;
    const timer = setInterval(() => {
      if (++tries > 50 || this._removed) { clearInterval(timer); return; }
      this._syncBorderVisibility();
      if (this._vueDblEl) clearInterval(timer);
    }, 100);
  }

  onPropertyChanged(name, value) {
    if (name === "showBorder") {
      this._syncBorderVisibility();
    }
  }

  onRemoved() {
    detachVueDblClick(this);
    fontBar.clearSelected(this); // 清掉选中态线框标记
    if (this.isEditing) removeTitleEditor(this);
  }

  inResizeCorner(x, y) {
    return this.resizable;
  }

  // 右键菜单加帮助
  getExtraMenuOptions(canvas, options) {
    const helpItem = {
      content: "🛟 帮助",
      callback: () => {
        showHelpDialog(this, `
          <p>「大江 标题」节点允许你在画布任意位置添加浮动文字标签。</p>
          <ul>
            <li><p><strong>单击标签：</strong>下方弹出字号/字距横条，上下两行分别左右拖动即可改字体大小和字距（也可在右侧数字框输入精确值，回车生效）；选中时文字外有 50% 灰色线框。</p></li>
            <li><p><strong>双击标签：</strong>原地编辑文字内容（Enter 保存，Esc 取消，Shift+Enter 换行）。</p></li>
            <li><p><strong>样式调整：</strong>右键菜单「属性」打开属性面板，可改字体家族、颜色、对齐方式、背景色、内边距、圆角、旋转角度。</p></li>
            <li><p><strong>钉住：</strong>右键菜单选择「钉住」可以让标签固定在工作流上，点击穿透。再次右键可以取消钉住。</p></li>
            <li><p><strong>颜色用十六进制</strong>，如 <code>#FFFFFF</code> 白色、<code>#660000</code> 深红。第 7-8 位控制透明度，如 <code>#FFFFFF88</code> 半透明白。</p></li>
          </ul>
        `);
      },
    };
    options.push(null, helpItem);
    return [];
  }
}

// ── 劫持 drawNode：完全跳过原版，自己画（彻底杜绝灰虚框）──────
// 原理：LiteGraph 的 drawNode 内部会调 drawNodeShape 画选中态虚框，
// 且 Vue 版下 node.selected / show_border 等属性已失效。
// 最稳的做法：不调原版，自己画背景 + 文字，虚框自然不存在。
const oldDrawNode = LGraphCanvas.prototype.drawNode;
LGraphCanvas.prototype.drawNode = function (node, ctx) {
  if (node.constructor === DJTitlePlate) {
    // 直接调节点自己的 draw（它内部会 save/restore、算尺寸、画背景+文字）
    node.draw(ctx);
    return true;
  }
  return oldDrawNode.apply(this, arguments);
};

// ── 劫持 getNodeOnPos：钉住的标签点击穿透 ─────────────────
const oldGetNodeOnPos = LGraph.prototype.getNodeOnPos;
LGraph.prototype.getNodeOnPos = function (x, y, nodes_list) {
  if (nodes_list) {
    const isMouseDown =
      LGraphCanvas.active_canvas &&
      LGraphCanvas.active_canvas.mouse_is_down;
    if (isMouseDown) {
      let isDoubleClick = LiteGraph.getTime() - LGraphCanvas.active_canvas.last_mouseclick < 300;
      if (!isDoubleClick) {
        nodes_list = [...nodes_list].filter(
          (n) => !(n instanceof DJTitlePlate) || !n.flags?.pinned
        );
      }
    }
  }
  return oldGetNodeOnPos.apply(this, [x, y, nodes_list]);
};

// ── 注册扩展 ──────────────────────────────────────────────
app.registerExtension({
  name: "dj.TitlePlate",
  // 接管后端影子节点：用前端虚拟类替换，使其进入搜索框与右键菜单
  beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeType !== DJTitlePlate.type) return;
    // 把后端定义的输入/输出清掉，改由前端类自己管理
    nodeData.input = {};
    nodeData.output = {};
    nodeData.output_is_list = [];
    nodeData.output_name = [];
    nodeData.name = "大江 标题";
    nodeData.category = "大江";
    return true; // 继续用前端类注册
  },
  registerCustomNodes() {
    LiteGraph.registerNodeType(DJTitlePlate.type, DJTitlePlate);
  },
});
