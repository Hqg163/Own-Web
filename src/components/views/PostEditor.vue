<template>
  <main class="container editor-page page-section">
    <header class="editor-head">
      <RouterLink class="button button-ghost" to="/creation"><AppIcon name="arrow-left" :size="17"/>返回创作中心</RouterLink>
      <span class="muted" aria-live="polite">{{ saveLabel }}</span>
      <div><button class="button" type="button" :disabled="saving" @click="save('draft')">保存草稿</button><button class="button button-primary" type="button" :disabled="saving" @click="save('published')">{{saving?'保存中…':'发布'}}</button></div>
    </header>
    <p v-if="error" class="error" role="alert">{{error}}</p>
    <div class="editor-grid">
      <section>
        <div class="field"><label for="title">标题</label><input id="title" v-model="form.title" placeholder="给文章一个明确的标题" @input="queueAutosave"/></div>
        <div class="field"><label for="excerpt">摘要</label><textarea id="excerpt" v-model="form.excerpt" placeholder="一句话说明文章内容" @input="queueAutosave"/></div>
        <div class="mode-tabs"><span>写作方式</span><button class="button button-ghost" :class="{active:mode==='blocks'}" type="button" @click="switchMode('blocks')">可视化</button><button class="button button-ghost" :class="{active:mode==='markdown'}" type="button" @click="switchMode('markdown')">Markdown</button></div>
        <template v-if="mode==='blocks'">
          <div class="rich-tools" aria-label="编辑工具栏">
            <button v-for="tool in tools" :key="tool.label" class="icon-button" type="button" :aria-label="tool.label" :title="tool.label" @click="tool.action"><AppIcon :name="tool.icon"/></button>
            <button class="button button-ghost" type="button" @click="imageInput?.click()">插入图片</button><input ref="imageInput" class="visually-hidden" type="file" accept="image/*" @change="uploadImage"/>
          </div>
          <EditorContent v-if="editor" :editor="editor!" class="rich-editor"/>
        </template>
        <template v-else>
          <div class="rich-tools"><button v-for="tool in markdownTools" :key="tool.label" class="button button-ghost" type="button" @click="insertMarkdown(tool.before,tool.after)">{{tool.label}}</button></div>
          <div class="field"><label for="markdown">正文（Markdown）</label><textarea id="markdown" ref="markdownInput" v-model="form.contentMarkdown" class="markdown-editor" placeholder="开始写作…" @input="queueAutosave"/></div>
        </template>
        <section class="preview"><p class="eyebrow">Preview</p><h2>{{form.title||'文章标题'}}</h2><div v-html="previewHtml"/></section>
      </section>
      <aside class="card settings">
        <h2>发布设置</h2><div class="field"><label for="slug">URL slug</label><input id="slug" v-model="form.slug" @input="queueAutosave"/></div>
        <div class="field"><label for="categories">分类</label><select id="categories" v-model="form.categorySlugs" multiple @change="queueAutosave"><option v-for="category in taxonomy.categories" :key="category.slug" :value="category.slug">{{category.name}}</option></select></div>
        <div class="field"><label for="tags">标签</label><input id="tags" v-model="form.tagText" placeholder="以逗号分隔" @input="queueAutosave"/></div>
        <div class="field"><label for="visibility">可见范围</label><select id="visibility" v-model="form.visibility" @change="queueAutosave"><option value="public">公开</option><option value="private">仅自己</option><option value="followers">关注者</option><option value="unlisted">仅分享链接</option></select></div>
        <div class="field"><label for="scheduled">计划发布时间</label><input id="scheduled" v-model="form.scheduledAt" type="datetime-local" @input="queueAutosave"/></div><label class="check"><input v-model="form.allowComments" type="checkbox" @change="queueAutosave"/>允许评论</label><p class="muted">私密内容不会出现在公开发现流。</p>
      </aside>
    </div>
  </main>
</template>

<script setup lang="ts">
import {computed,nextTick,onBeforeUnmount,onMounted,ref,shallowRef} from 'vue'
import {RouterLink,onBeforeRouteLeave,useRoute,useRouter} from 'vue-router'
import {Editor,EditorContent} from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import {Table} from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import {Markdown} from '@tiptap/markdown'
import {marked} from 'marked'
import DOMPurify from 'dompurify'
import http from '@/services/http'
import AppIcon from '@/components/AppIcon.vue'

type Mode='blocks'|'markdown'
const route=useRoute(),router=useRouter(),editor=shallowRef<Editor>(),imageInput=ref<HTMLInputElement>(),markdownInput=ref<HTMLTextAreaElement>(),postId=ref<number|null>(null),mode=ref<Mode>(route.params.id?'markdown':'blocks'),saving=ref(false),lastSaved=ref(''),error=ref(''),timer=ref<number>(),dirty=ref(false),taxonomy=ref<any>({categories:[]})
const form=ref<any>({title:'',excerpt:'',contentMarkdown:'',slug:'',visibility:'private',allowComments:true,scheduledAt:'',categorySlugs:[],tagText:''})
const saveLabel=computed(()=>saving.value?'正在保存…':lastSaved.value?('已保存 '+lastSaved.value):'未保存')
const previewHtml=computed(()=>mode.value==='blocks'&&editor.value?DOMPurify.sanitize(editor.value.getHTML()):DOMPurify.sanitize(String(marked.parse(form.value.contentMarkdown||''))))
const tools=computed(()=>[
  {label:'粗体',icon:'pen',action:()=>editor.value?.chain().focus().toggleBold().run()},{label:'斜体',icon:'pen',action:()=>editor.value?.chain().focus().toggleItalic().run()},{label:'删除线',icon:'close',action:()=>editor.value?.chain().focus().toggleStrike().run()},{label:'引用',icon:'more',action:()=>editor.value?.chain().focus().toggleBlockquote().run()},{label:'列表',icon:'list',action:()=>editor.value?.chain().focus().toggleBulletList().run()},{label:'代码块',icon:'code',action:()=>editor.value?.chain().focus().toggleCodeBlock().run()},{label:'分割线',icon:'more',action:()=>editor.value?.chain().focus().setHorizontalRule().run()},{label:'表格',icon:'grid',action:()=>editor.value?.chain().focus().insertTable({rows:3,cols:3,withHeaderRow:true}).run()}
])
const markdownTools=[{label:'粗体',before:'**',after:'**'},{label:'斜体',before:'*',after:'*'},{label:'引用',before:'> ',after:''},{label:'列表',before:'- ',after:''},{label:'代码',before:'\`\`\`\\n',after:'\\n\`\`\`'},{label:'链接',before:'[',after:'](https://)'}]
function makeEditor(content:any=null){editor.value?.destroy();editor.value=new Editor({extensions:[StarterKit.configure({link:false}),Image.configure({allowBase64:false}),Link.configure({openOnClick:false}),Table.configure({resizable:true}),TableRow,TableHeader,TableCell,Markdown],content:content||{type:'doc',content:[{type:'paragraph'}]},onUpdate:()=>{dirty.value=true;queueAutosave()}})}
function blocks(){return editor.value?.getJSON()||{type:'doc',content:[{type:'paragraph'}]}}
async function switchMode(next:Mode){if(next===mode.value)return;if(next==='blocks'){makeEditor();try{(editor.value as any).commands.setContent(form.value.contentMarkdown||'',{contentType:'markdown'})}catch{editor.value?.commands.setContent(form.value.contentMarkdown||'')}mode.value='blocks'}else{form.value.contentMarkdown=(editor.value as any)?.getMarkdown?.()||editor.value?.getText({blockSeparator:'\n'})||'';mode.value='markdown'}dirty.value=true;await nextTick();queueAutosave()}
function insertMarkdown(before:string,after:string){const input=markdownInput.value;if(!input)return;const start=input.selectionStart,end=input.selectionEnd,text=form.value.contentMarkdown;form.value.contentMarkdown=text.slice(0,start)+before+text.slice(start,end)+after+text.slice(end);dirty.value=true;nextTick(()=>{input.focus();input.setSelectionRange(start+before.length,end+before.length)});queueAutosave()}
async function ensureDraft(){if(postId.value)return;const data:any={title:form.value.title};if(mode.value==='blocks')data.contentBlocks=blocks();else data.contentMarkdown=form.value.contentMarkdown;postId.value=(await http.post('/api/posts',data)).data.post.id}
function payload(status?:string){const data:any={...form.value,tags:form.value.tagText.split(',').map((v:string)=>v.trim()).filter(Boolean),status:form.value.scheduledAt?'scheduled':status};if(mode.value==='blocks')data.contentBlocks=blocks();else data.contentMarkdown=form.value.contentMarkdown;return data}
function queueAutosave(){if(timer.value)clearTimeout(timer.value);timer.value=window.setTimeout(async()=>{try{saving.value=true;await ensureDraft();const r=await http.post('/api/posts/'+postId.value+'/autosave',payload());lastSaved.value=new Date(r.data.savedAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});dirty.value=false}catch(e:any){error.value=e.response?.data?.error?.message||'自动保存失败'}finally{saving.value=false}},1200)}
async function save(status:string){saving.value=true;error.value='';try{await ensureDraft();await http.put('/api/posts/'+postId.value,payload(status));lastSaved.value='刚刚';dirty.value=false;if(status==='published')router.push('/creation')}catch(e:any){error.value=e.response?.data?.error?.message||'保存失败，请稍后重试'}finally{saving.value=false}}
async function uploadImage(event:Event){const file=(event.target as HTMLInputElement).files?.[0];if(!file)return;const alt=window.prompt('请填写图片替代文本');if(!alt?.trim()){error.value='图片必须填写替代文本';return}try{await ensureDraft();const data=new FormData();data.append('image',file);data.append('altText',alt.trim());data.append('postId',String(postId.value));const media=(await http.post('/api/posts/media',data)).data.media;if(mode.value==='blocks')editor.value?.chain().focus().setImage({src:media.url,alt:media.altText}).run();else form.value.contentMarkdown+='\\n\\n!['+media.altText+']('+media.url+')\\n';queueAutosave()}catch(e:any){error.value=e.response?.data?.error?.message||'图片上传失败'}finally{(event.target as HTMLInputElement).value=''}}
onMounted(async()=>{makeEditor();try{taxonomy.value=(await http.get('/api/public/taxonomy')).data}catch{}if(route.params.id){try{const post=(await http.get('/api/posts/'+route.params.id)).data.post;postId.value=post.id;form.value={title:post.title,excerpt:post.excerpt||'',contentMarkdown:post.content_markdown||'',slug:post.slug,visibility:post.visibility,allowComments:!!post.allow_comments,scheduledAt:post.scheduled_at?String(post.scheduled_at).slice(0,16):'',categorySlugs:post.categorySlugs||[],tagText:(post.tags||[]).join(', ')};if(post.content_format==='blocks'&&post.content_blocks){mode.value='blocks';makeEditor(typeof post.content_blocks==='string'?JSON.parse(post.content_blocks):post.content_blocks)}else mode.value='markdown'}catch{error.value='无法加载文章'}}})
onBeforeRouteLeave(()=>!dirty.value||saving.value||window.confirm('文章有未保存的修改，确定离开吗？'))
onBeforeUnmount(()=>{if(timer.value)clearTimeout(timer.value);editor.value?.destroy()})
</script>

<style scoped>
.editor-page{max-width:1200px}.editor-head,.editor-head>div,.mode-tabs,.rich-tools{display:flex;align-items:center;gap:var(--space-2);flex-wrap:wrap}.editor-head{justify-content:space-between;margin-bottom:var(--space-4)}.editor-grid{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:var(--space-5)}.mode-tabs{margin:var(--space-4) 0 var(--space-2);padding-bottom:var(--space-2);border-bottom:1px solid var(--border)}.mode-tabs span{margin-right:auto;color:var(--muted);font-size:.9rem}.mode-tabs .active{border-color:var(--accent);background:var(--accent-soft);color:var(--accent)}.rich-tools{padding:var(--space-2);border:1px solid var(--border);border-radius:var(--radius-sm) var(--radius-sm) 0 0;background:var(--surface)}.icon-button{display:grid;place-items:center;width:34px;height:34px;padding:0;border:1px solid transparent;border-radius:var(--radius-sm);background:transparent;color:var(--muted)}.icon-button:hover{border-color:var(--border);background:var(--accent-soft);color:var(--accent)}.rich-editor{min-height:430px;padding:var(--space-4);border:1px solid var(--border);border-top:0;border-radius:0 0 var(--radius-sm) var(--radius-sm);background:var(--surface);line-height:1.8}.rich-editor :deep(.tiptap){min-height:400px;outline:0}.rich-editor :deep(img){max-width:100%;height:auto}.rich-editor :deep(table){border-collapse:collapse}.rich-editor :deep(td),.rich-editor :deep(th){min-width:80px;padding:6px;border:1px solid var(--border)}.markdown-editor{min-height:440px;font-family:ui-monospace,monospace;line-height:1.65}.settings{align-self:start;padding:var(--space-4)}.settings h2{margin-top:0;font-size:1.05rem}.check{display:flex;align-items:center;gap:var(--space-2);margin-top:var(--space-3)}.preview{max-width:760px;margin:var(--space-7) auto 0;padding-top:var(--space-5);border-top:1px solid var(--border);line-height:1.85}.preview :deep(img){max-width:100%;height:auto}.error{color:var(--danger)}@media(max-width:800px){.editor-grid{grid-template-columns:1fr}.settings{order:-1}.editor-head{align-items:start}}@media(max-width:560px){.editor-head{align-items:stretch;flex-direction:column}.editor-head>div .button{flex:1}.mode-tabs span{width:100%}}
</style>
