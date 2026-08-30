<template>
  <main class="container page-section manager-page">
    <header class="manager-head"><div><RouterLink class="back-link" to="/creation">← 创作中心</RouterLink><p class="eyebrow">Series</p><h1 class="page-title">系列管理</h1><p class="muted">整理自己的文章顺序；公开页面只展示其中公开发布的文章。</p></div><button class="button button-primary" type="button" @click="startCreate">新建系列</button></header>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <div v-if="loading" class="empty" role="status">正在载入系列…</div>
    <section v-else-if="!series.length" class="empty"><AppIcon name="book" :size="24" /><p>还没有系列。</p><button class="button button-secondary" type="button" @click="startCreate">新建系列</button></section>
    <section v-else class="series-list"><article v-for="item in series" :key="item.id" class="card series-item"><div><h2>{{ item.name }}</h2><p class="muted">/{{ item.slug }}<span v-if="item.article_count"> · {{ item.article_count }} 篇公开文章</span></p><p>{{ item.description || '暂无说明' }}</p></div><div class="item-actions"><button class="button" type="button" @click="edit(item)">编辑</button><button class="button button-danger" type="button" @click="remove(item)">删除</button></div></article></section>
    <div v-if="editing" class="dialog-backdrop" @click.self="close"><form class="dialog card" role="dialog" aria-modal="true" aria-labelledby="series-form-title" @submit.prevent="save"><div class="dialog-head"><h2 id="series-form-title">{{ form.id ? '编辑系列' : '新建系列' }}</h2><button class="icon-button" type="button" aria-label="关闭" @click="close">×</button></div><div class="field"><label for="series-name">名称</label><input id="series-name" v-model="form.name" required maxlength="160" /></div><div class="field"><label for="series-slug">标识</label><input id="series-slug" v-model="form.slug" maxlength="180" placeholder="留空则按名称生成" /></div><div class="field"><label for="series-description">说明</label><textarea id="series-description" v-model="form.description" rows="5" maxlength="1000" /></div><div class="field"><label for="series-cover">封面 URL（可选）</label><input id="series-cover" v-model="form.cover" placeholder="https://…" /></div><div class="dialog-actions"><button class="button" type="button" @click="close">取消</button><button class="button button-primary" type="submit" :disabled="saving">{{ saving ? '保存中…' : '保存系列' }}</button></div></form></div>
  </main>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import http from '@/services/http'

const series = ref<any[]>([]); const loading = ref(true); const saving = ref(false); const error = ref(''); const editing = ref(false)
const blank = () => ({ id: null, name: '', slug: '', description: '', cover: '' }); const form = reactive<any>(blank())
async function load() { loading.value = true; error.value = ''; try { series.value = (await http.get('/api/series')).data.items || [] } catch (e: any) { error.value = e.response?.data?.error?.message || '系列暂时无法载入。' } finally { loading.value = false } }
function startCreate() { Object.assign(form, blank()); editing.value = true }; function edit(item: any) { Object.assign(form, { ...blank(), ...item }); editing.value = true }; function close() { if (!saving.value) editing.value = false }
async function save() { saving.value = true; error.value = ''; try { if (form.id) await http.put(`/api/series/${form.id}`, form); else await http.post('/api/series', form); editing.value = false; await load() } catch (e: any) { error.value = e.response?.data?.error?.message || '系列保存失败。' } finally { saving.value = false } }
async function remove(item: any) { if (!window.confirm(`确定删除“${item.name}”吗？文章会保留，但会解除系列归属。`)) return; try { await http.delete(`/api/series/${item.id}`); await load() } catch (e: any) { error.value = e.response?.data?.error?.message || '系列删除失败。' } }
onMounted(load)
</script>

<style scoped>
.manager-page { max-width: 960px; }.manager-head { display: flex; align-items: end; justify-content: space-between; gap: var(--space-5); margin-bottom: var(--space-5); }.back-link { color: var(--accent); text-decoration: none; }.manager-head h1 { margin: var(--space-2) 0; }.manager-head p:last-child { margin-bottom: 0; }.series-list { display: grid; gap: var(--space-3); }.series-item { display: flex; align-items: start; justify-content: space-between; gap: var(--space-4); padding: var(--space-4); }.series-item h2 { margin: 0; font-size: 1.1rem; }.series-item p { margin: var(--space-1) 0 0; line-height: 1.6; }.item-actions { display: flex; flex: none; gap: var(--space-2); }.empty { display: grid; justify-items: center; gap: var(--space-2); padding: var(--space-8) var(--space-5); }.dialog-backdrop { position: fixed; z-index: 30; inset: 0; display: grid; place-items: center; padding: var(--space-4); background: var(--scrim); }.dialog { width: min(640px, 100%); padding: var(--space-5); background: var(--surface); }.dialog-head { display: flex; align-items: center; justify-content: space-between; }.dialog-head h2 { margin: 0; }.dialog-actions { display: flex; justify-content: end; gap: var(--space-2); margin-top: var(--space-4); }@media (max-width: 640px) { .manager-head, .series-item { align-items: stretch; flex-direction: column; }.item-actions .button { flex: 1; } }
</style>
