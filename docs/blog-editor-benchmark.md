# Blog Editor Benchmark

| Feature | Own-Web | Ghost | Gutenberg | Medium | Hashnode | DEV | Decision |
|---|---|---|---|---|---|---|---|
| Block editing | Tiptap blocks | Cards | Blocks | Low-distraction editor | Rich editor | Markdown/editor | Improve |
| Markdown | Markdown canonical mode | Markdown card | conversion/import | limited | supported workflow | native workflow | Keep |
| Image/gallery/caption | owned media and gallery nodes | cards/gallery | media blocks | image insertion | cover/media | embeds/media | Improve |
| Code/highlight/copy | language attribute and copy enhancement | code card | code block | limited | code blocks | fenced code | Improve |
| Math | KaTeX inline/block | not a core card | extension-dependent | not native | editor-dependent | markdown-dependent | Implement |
| Table/callout/toggle | custom nodes | cards | blocks | limited | editor features | markdown conventions | Improve |
| Bookmark/embed | HTTPS allowlist | bookmark/embed cards | embeds | embeds | embeds | embeds | Keep safe allowlist |
| Footnote/diagram | custom nodes | limited | extension-dependent | limited | extension-dependent | markdown | Implement safely |
| Cover/preview | cover and in-editor preview | feature-rich | featured image/preview | publish preview | cover/preview | publish workflow | Keep |
| Autosave/revision | API revisions and autosave | autosave | autosave/revisions | draft workflow | autosave | draft workflow | Improve |
| Scheduled publishing | API support | supported | supported | publish workflow | supported | unpublished workflow | Keep |
| Mobile authoring | responsive editor | responsive | responsive | strong focus | responsive | responsive | Improve |

Sources: [Ghost Cards](https://ghost.org/help/cards/), [WordPress Block Editor](https://wordpress.org/documentation/article/wordpress-block-editor/), [Medium Story Editor](https://help.medium.com/hc/en-us/articles/215194537-Using-the-story-editor), [Hashnode Editor](https://docs.hashnode.com/blogs/editor/writing-a-blog-post), [DEV Editor Guide](https://dev.to/p/editor_guide/).

The benchmark is a decision record, not a request to reproduce a full CMS. Deferred capabilities remain explicitly deferred in the audit report.
