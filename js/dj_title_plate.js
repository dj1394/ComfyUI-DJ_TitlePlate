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
          <p><b>双击节点</b>即可原地编辑文字内容（Enter 保存，Esc 取消，Shift+Enter 换行）。</p>
          <ul>
            <li><p><strong>样式调整：</strong>右键菜单「属性」打开属性面板，可改字体大小、字体家族、颜色、对齐方式、背景色、内边距、圆角、旋转角度。</p></li>
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
