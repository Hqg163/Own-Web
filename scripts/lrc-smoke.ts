import assert from 'node:assert/strict'
import {findActiveLyricIndex,getCenteredScrollTop,parseLrc} from '../src/utils/lrc'

const parsed=parseLrc(`[ti:审计曲目]\n[offset:250]\n[00:01.20][00:02.345]第一句\n[00:02.345]重复时间\n[00:03]最后一句`)
assert.deepEqual(parsed.lines.map(item=>Number(item.time.toFixed(3))),[1.2,2.345,2.345,3],'应解析多时间标签、毫秒精度并稳定排序')
assert.equal(parsed.offsetSeconds,.25,'元数据 offset 应作为独立的同步偏移保留')
assert.equal(parsed.lines[0].text,'第一句')
assert.equal(parsed.lines[2].text,'重复时间')
assert.equal(findActiveLyricIndex(parsed.lines,2.6,parsed.offsetSeconds),2,'重复时间点应选择最后一个已到达条目')
assert.equal(findActiveLyricIndex([],3),-1,'无歌词不应生成伪歌词索引')
assert.equal(getCenteredScrollTop(300,900,40,28),0,'首行居中位置应钳制到顶部')
assert.equal(getCenteredScrollTop(300,900,800,28),600,'尾行居中位置应钳制到底部')
console.log('lrc-smoke: passed')
