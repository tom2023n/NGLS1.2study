# NGSL常用词学习

适合手机的 NGSL 1.2 词汇学习页。2809 个核心词，闪卡、测验、收藏，进度保存在本机，可以添加到主屏幕。

学习方式参考了 [词光 Word Atlas](https://github.com/designfuchen/word-atlas)：先看见词（有插画的词会显示图），再用 FSRS 在快忘记的时候安排复习。答对一次不会直接变成「已掌握」。已掌握指复习状态且记忆稳定度至少 21 天。

## 可以做什么

- 今日队列：先复习到期的词，再认识新词（默认每天 10 个，可在「我的」里改）
- 浏览词库：按词频分段、学习状态、收藏和搜索
- 闪卡：正面是词和图，背面有词头、中文、释义和例句，长内容在卡片内滚动
- 评分：`1` 还不熟，`2` 记住了。桌面端空格翻转，左右方向键切换
- 测验：看中文选英文。中文释义相同的词不会同时出现在选项里
- 英音 / 美音：有录音时播放词光的发音，否则用设备语音
- 导出、导入 JSON 进度
- 离线壳：页面和脚本优先走网络，避免旧缓存卡住更新；插画和发音看过之后会缓存

## 运行

在项目目录启动静态服务后打开页面：

```powershell
python -m http.server 4173
```

```text
http://127.0.0.1:4173/index.html
```

直接双击 `index.html` 时，部分浏览器会拦截模块脚本，请用上面的本地服务。

## 发布到 GitHub Pages

不需要构建。在仓库 Settings → Pages 里选择：

- Source：Deploy from a branch
- Branch：`main`
- Folder：`/ (root)`

## 插画

2809 个词里有 **2562** 个用了词光的 256px WebP 缩略图，以及英音、美音 MP3。其余 **247** 个词光里没有对应插画（多半是 the、be、of 这类功能词），页面会显示字母图版，不会出现破图。清单在 `docs/missing-illustrations.csv`（word、中文释义、词性）。

署名：**Word Atlas contributors — CC BY 4.0**  
协议：<https://creativecommons.org/licenses/by/4.0/>  
修改说明：未改画面和录音，只选取了与 NGSL 1.2 重合的词。13 个美式拼写对应到词光的英式词头，例如 color → colour。代码改编部分的 MIT 声明在 `THIRD_PARTY.md`。

### 词光插画风格

复古图鉴、世纪中期编辑插画。奶油色纸底，颜色限制在墨蓝、赤陶红、芥末赭、灰绿和天蓝。形状扁平，剪影干净，有一点孔版印刷的颗粒，主体居中，四周留白，画面里没有文字。

### 用 ComfyUI 补缺图

缺图列表里的词可以在本机用同一套提示词生成，不要把新图和词光原图混用不同画风。输出正方形，再压成 256px WebP，文件名用小写英文词头，放到 `assets/thumb/`。

```text
Mid-century modern editorial illustration, like a plate from a vintage illustrated field guide. Strict limited palette: deep ink navy, warm terracotta, mustard ochre, muted sage green and soft sky blue on warm cream paper. Flat geometric shapes, confident clean silhouettes, subtle risograph grain and paper texture, gentle shading, one clear focal subject with generous negative space, centered square composition, calm and charming mood. Absolutely no text, letters, words, numbers, captions, signs, logos, watermarks or frames.

Scene: {用一句具体画面描述这个词的日常场景，画动作或物体，不要画出单词}
```

示例：`frame` 可以写成 `Scene: a wooden picture frame leaning on a table, with a landscape painting inside it`。

压缩示例：

```bash
cwebp -q 78 -resize 256 256 frame.png -o assets/thumb/frame.webp
```

## 进度

进度键名仍是 `ngsl-study-progress-v1`。旧版本里的「已掌握 / 学习中 / 收藏 / 连续天数」会在打开页面时迁入 FSRS 卡片，不会清空。
