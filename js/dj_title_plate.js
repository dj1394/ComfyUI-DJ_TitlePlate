import { app } from "/scripts/app.js";

// ── CSS 注入 ──────────────────────────────────────────────
const style = document.createElement("style");
style.textContent = `
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
  /* 双击原地编辑的输入框 */
  .dj-title-plate-editor {
    position: absolute;
    z-index: 1000;
    border: 2px solid #4a9eff;
    border-radius: 4px;
    background: rgba(30, 30, 30, 0.95);
    color: #fff;
    outline: none;
    resize: none;
    overflow: hidden;
    padding: 4px 6px;
    font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
    line-height: 1.3;
    box-shadow: 0 4px 16px rgba(0,0,0,0.6);
  }
`;

// ── 字号横条常量（与 DJ_GroupTitle 一致）──────────────────
const MIN_FONT_SIZE = 12;
const MAX_FONT_SIZE = 300;
const FONT_SLIDER_PIXELS_PER_STEP = 2; // 拖动速率：每 2 屏幕像素 = 1 号字
const FONT_SLIDER_VISUAL_MAX = 96;     // 滑块填充视觉上限（超过后不再变长）
const FONT_BAR_WIDTH = 236;            // 横条宽度

// ── 字号横条（点击标签上方弹出，拖动改字号）───────────────
const fontBar = {
  panel: null,
  sliderFill: null,
  numberInput: null,
  anchorNode: null,
  drag: null,
  frameHandle: 0,

  clamp(value) {
    const n = Number(value);
    return Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, Math.round(Number.isFinite(n) ? n : 32)));
  },

  setFontSize(size) {
    const node = this.anchorNode;
    if (!node) return;
    const s = this.clamp(size);
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

  syncSlider(size) {
    const s = this.clamp(size);
    if (this.sliderFill) {
      const span = FONT_SLIDER_VISUAL_MAX - MIN_FONT_SIZE;
      const ratio = span > 0 ? (s - MIN_FONT_SIZE) / span : 0;
      this.sliderFill.style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
    }
    if (this.numberInput && document.activeElement !== this.numberInput) {
      this.numberInput.value = String(s);
    }
  },

  // 锚定在标签上方，跟随缩放/平移（每帧重算）
  positionPanel() {
    const node = this.anchorNode;
    const canvas = LGraphCanvas.active_canvas;
    if (!this.panel || !node?.pos || !canvas?.canvas?.isConnected) return;

    const [localX, localY] = canvas.canvasPosToDom([
      Number(node.pos[0]) || 0,
      (Number(node.pos[1]) || 0) - 12, // 标签上沿再往上 12px
    ]);
    const rect = canvas.canvas.getBoundingClientRect();
    const width = this.panel.offsetWidth || FONT_BAR_WIDTH;
    const height = this.panel.offsetHeight || 34;
    const maxTop = Math.max(8, window.innerHeight - height - 8);
    const left = Math.min(
      Math.max(8, rect.left + localX),
      Math.max(8, window.innerWidth - width - 8),
    );
    const top = Math.min(Math.max(8, rect.top + localY - height), maxTop);
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
      alignItems: "center",
      gap: "8px",
      width: `${FONT_BAR_WIDTH}px`,
      padding: "7px 8px",
      border: "1px solid rgba(255, 255, 255, 0.16)",
      borderRadius: "6px",
      background: "rgba(31, 34, 42, 0.98)",
      boxShadow: "0 6px 22px rgba(0, 0, 0, 0.45)",
      boxSizing: "border-box",
      font: "12px/1.2 Inter, sans-serif",
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

    panel.append(track, numberInput);
    document.body.appendChild(panel);

    this.panel = panel;
    this.sliderFill = fill;
    this.numberInput = numberInput;

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
  },

  open(node) {
    if (!node) return;
    this.close();
    this.anchorNode = node;
    this.ensurePanel();
    this.drag = null;
    this.syncSlider(node.properties.fontSize);
    this.panel.style.display = "flex";
    this.positionPanel();
    this.startFollow();
  },

  close() {
    this.drag = null;
    this.anchorNode = null;
    this.stopFollow();
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
  const node = LGraphCanvas.active_canvas?.graph?.getNodeOnPos?.(
    ...LGraphCanvas.active_canvas.convertEventToCanvasOffset(event),
  );
  if (node instanceof DJTitlePlate) {
    // 记录双击判定：第二次点击交给 onDblClick（文字编辑）
    const last = fontBar._lastClick;
    const isDouble = last && last.node === node && event.timeStamp - last.timeStamp < 400;
    fontBar._lastClick = { node, timeStamp: event.timeStamp };
    if (!isDouble) fontBar.open(node);
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
document.head.appendChild(style);

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
    };
    this.color = "#fff0";
    this.bgcolor = "#fff0";
    this.resizable = false;
    this.isVirtualNode = true;
    this.widgets = [];
    this._editing = false;
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

    ctx.font = `${fontSize}px ${fontFamily}`;

    const lines = this.getText().split("\n");

    const maxWidth = Math.max(20, ...lines.map((s) => ctx.measureText(s).width));
    this.size[0] = maxWidth + padding * 2;
    this.size[1] = fontSize * lines.length * 1.3 + padding * 2;

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

    // 文字
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

    ctx.textBaseline = "top";
    ctx.fillStyle = fontColor;
    let currentY = padding;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i] || " ", textX, currentY);
      currentY += fontSize * 1.3;
    }
    ctx.restore();
  }

  // ── 双击：原地弹出输入框直接改文字 ─────────────────────
  onDblClick(event, pos, canvas) {
    if (this._editing) return;
    this._startInlineEdit(canvas);
  }

  _startInlineEdit(canvas) {
    this._editing = true;
    const graphCanvas = canvas || LGraphCanvas.active_canvas;

    // 节点左上角在屏幕上的位置
    const topLeft = graphCanvas.canvasPosToDom([this.pos[0], this.pos[1]]);
    const fontSize = Math.max(this.properties.fontSize || 1, 1);
    const fontFamily = this.properties.fontFamily ?? "Arial";
    const padding = Number(this.properties.padding) ?? 0;

    const ta = document.createElement("textarea");
    ta.className = "dj-title-plate-editor";
    ta.value = this.getText();
    ta.style.left = `${topLeft[0] + 4}px`;
    ta.style.top = `${topLeft[1] + 4}px`;
    ta.style.font = `${fontSize}px ${fontFamily}`;
    ta.style.color = this.properties.fontColor || "#ffffff";
    ta.style.minWidth = "120px";
    ta.style.minHeight = `${this.size[1] + 8}px`;

    // 编辑期间暂停画布重绘，避免输入框位置漂移
    graphCanvas.pause_rendering();

    const finish = (commit) => {
      if (commit) {
        this.title = ta.value.replace(/\n/g, "\\n");
      }
      ta.remove();
      this._editing = false;
      graphCanvas.resume_rendering();
      graphCanvas.draw(true); // 强制重绘一次
    };

    ta.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        finish(true);
      } else if (e.key === "Escape") {
        e.preventDefault();
        finish(false);
      }
      e.stopPropagation();
    });
    ta.addEventListener("blur", () => finish(true));

    document.body.appendChild(ta);
    ta.focus();
    ta.select();
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
            <li><p><strong>单击标签：</strong>上方弹出字号横条，左右拖动即可改字体大小（也可在右侧数字框输入精确值，回车生效）。</p></li>
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

// ── 劫持 drawNode：让 Label 用我们的 draw ─────────────────
const oldDrawNode = LGraphCanvas.prototype.drawNode;
LGraphCanvas.prototype.drawNode = function (node, ctx) {
  if (node.constructor === DJTitlePlate) {
    node.bgcolor = "transparent";
    node.color = "transparent";
    const v = oldDrawNode.apply(this, arguments);
    node.draw(ctx);
    return v;
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
