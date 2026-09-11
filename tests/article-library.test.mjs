import test from 'node:test';
import assert from 'node:assert/strict';
import { combineArticles } from '../lib/article-library.mjs';
import { selectedReportMode } from '../lib/daily-report.mjs';
test('入库增加文章，原有资讯不消失，来源标记独立', () => {
  const previous = [{ id: 1, title: '原有资讯甲' }, { id: 2, title: '原有资讯乙' }];
  const added = [{ id: 1000000001, title: '新入库' }];
  const result = combineArticles(previous, added, 'mock');
  assert.deepEqual(result.data.map(a => a.id), [1000000001, 1, 2]);
  assert.equal(result.mode, 'mixed');
  assert.equal(result.data[0].isSample, false);
  assert.ok(result.data.slice(1).every(a => a.isSample));
  assert.equal(previous[0].isSample, undefined);
  assert.equal(selectedReportMode([result.data[0]], result.mode), 'local');
  assert.equal(selectedReportMode(result.data.slice(1), result.mode), 'mock');
  assert.equal(selectedReportMode(result.data, result.mode), 'mixed');
});
test('无导入仍保留原库，数据库与本地文章均非示例', () => {
  assert.equal(combineArticles([{ id: 1 }], [], 'mock').data.length, 1);
  const result = combineArticles([{ id: 2 }], [{ id: 1000000001 }], 'postgres');
  assert.equal(result.data.length, 2);
  assert.ok(result.data.every(a => a.isSample === false));
  assert.equal(selectedReportMode(result.data, result.mode), 'local');
});
