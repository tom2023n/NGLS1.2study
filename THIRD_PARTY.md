# 第三方声明

## 词光 Word Atlas

界面思路、词卡结构和 FSRS 复习封装改编自 [词光 Word Atlas](https://github.com/designfuchen/word-atlas)。

- 代码与界面设计：MIT License。Copyright (c) 2026 Word Atlas contributors。
- 词库插画、缩略图与英美发音：CC BY 4.0。署名 **Word Atlas contributors — CC BY 4.0**，协议 <https://creativecommons.org/licenses/by/4.0/>。
- 本项目的修改：只收录与 NGSL 1.2 重合的词；插画使用词光原有的 256px WebP 缩略图，英美发音使用原 MP3，没有改画面或音频内容。英美拼写不同的 13 个词（如 color / colour）对应到词光里的英式词头。

MIT 许可全文：

```
MIT License

Copyright (c) 2026 Word Atlas contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Fraunces

英文词头使用 [Fraunces](https://github.com/undercasetype/Fraunces) 拉丁子集（可变字重），SIL Open Font License 1.1。许可全文在 `fonts/OFL.txt`。中文走系统宋体，不另外下载大字库。

## 音效

评分和翻卡用的是页面里用 Web Audio 生成的短提示音，不是词光仓库里的 `public/sfx`。那些界面声音没有单独写明可再分发的授权，所以没有拷贝。

## ts-fsrs

间隔重复算法来自 [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) 5.4.2（FSRS-6），文件在 `vendor/ts-fsrs.mjs`。

MIT License. Copyright (c) 2026 Open Spaced Repetition. 全文见 `vendor/ts-fsrs.LICENSE`。
