# -*- coding: utf-8 -*-
"""ComfyUI-DJ_TitlePlate —— 大江 标题（画布浮动文字标签）。

前端虚拟节点：真正的 UI 在 js/dj_title_plate.js 里实现。
这里注册一个后端"影子节点"，只为让节点进入 /object_info，
使 ComfyUI 的搜索框（Ctrl+K）能搜到它；执行时不产生任何输出。
"""

import os

WEB_DIRECTORY = os.path.join(os.path.dirname(os.path.abspath(__file__)), "js")


class DJ_TitlePlate:
    """影子节点：前端接管渲染，后端无实际功能。"""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "text": ("STRING", {"default": "", "multiline": True}),
            }
        }

    RETURN_TYPES = ()
    FUNCTION = "main"
    CATEGORY = "大江"
    OUTPUT_NODE = False

    def main(self, text):
        return ()


NODE_CLASS_MAPPINGS = {
    "DJ_TitlePlate": DJ_TitlePlate,
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "DJ_TitlePlate": "大江 标题",
}

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
