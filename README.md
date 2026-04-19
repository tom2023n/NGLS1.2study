# NGSL常用词学习

一个适合手机使用的 NGSL 常用词学习网页应用，支持：

- 闪卡学习
- 单词朗读
- 例句朗读
- 选择题测验
- 错词优先复习
- 按 rank 分段学习
- 收藏与最近学习记录
- 本地进度保存
- 添加到 iPhone 主屏幕作为网页 App 使用

## 运行所需文件

上传到 GitHub 时，保留这些文件即可：

- `index.html`
- `styles.css`
- `app.js`
- `words.js`
- `manifest.json`
- `sw.js`

## 本地打开

直接双击 `index.html` 即可，或者在当前目录启动静态服务：

```powershell
python -m http.server 4173
```

然后访问：

```text
http://127.0.0.1:4173/index.html
```

## 发布到 GitHub Pages

1. 新建一个 GitHub 仓库
2. 上传本项目核心文件
3. 打开仓库的 `Settings`
4. 找到 `Pages`
5. 在 `Build and deployment` 里选择：
   - `Source`: `Deploy from a branch`
   - `Branch`: `main`
   - Folder: `/ (root)`
6. 保存后等待几十秒

发布成功后，访问地址通常是：

```text
https://你的用户名.github.io/仓库名/
```

## 在 iPhone 上使用

1. 用 Safari 打开 GitHub Pages 地址
2. 点击分享按钮
3. 选择“添加到主屏幕”

这样就可以像 App 一样全屏打开。
