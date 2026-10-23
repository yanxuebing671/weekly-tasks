const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

// 数据持久化到 JSON 文件（Render 免费档：实例运行期间有效；需长期保存可挂 Render Disk 或换 Postgres）
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data.json');

function load() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch (e) { return { members: [], weeks: {}, updatedAt: Date.now() }; }
}
function save(s) {
  s.updatedAt = Date.now();
  fs.writeFileSync(DATA_FILE, JSON.stringify(s, null, 2));
}

let state = load();

// 拉取全部状态（前端轮询用）
app.get('/api/state', (req, res) => res.json(state));

// 新增 / 更新单条任务
app.put('/api/task', (req, res) => {
  const { weekKey, task } = req.body || {};
  if (!weekKey || !task || !task.id) return res.status(400).json({ error: 'bad' });
  state.weeks[weekKey] = state.weeks[weekKey] || [];
  const i = state.weeks[weekKey].findIndex(t => t.id === task.id);
  if (i >= 0) state.weeks[weekKey][i] = task;
  else state.weeks[weekKey].push(task);
  save(state);
  res.json({ ok: true });
});

// 删除任务
app.delete('/api/task/:weekKey/:id', (req, res) => {
  const { weekKey, id } = req.params;
  if (state.weeks[weekKey]) state.weeks[weekKey] = state.weeks[weekKey].filter(t => t.id !== id);
  save(state);
  res.json({ ok: true });
});

// 回填链接（素人交作业）
app.patch('/api/link', (req, res) => {
  const { weekKey, id, link } = req.body || {};
  const w = state.weeks[weekKey];
  if (!w) return res.status(404).json({ error: 'no week' });
  const t = w.find(x => x.id === id);
  if (!t) return res.status(404).json({ error: 'no task' });
  t.link = link || '';
  save(state);
  res.json({ ok: true });
});

// 更新成员列表
app.put('/api/members', (req, res) => {
  const { members } = req.body || {};
  if (!Array.isArray(members)) return res.status(400).json({ error: 'bad' });
  state.members = members;
  save(state);
  res.json({ ok: true });
});

// 批量导入
app.post('/api/batch', (req, res) => {
  const { weekKey, tasks } = req.body || {};
  if (!weekKey || !Array.isArray(tasks)) return res.status(400).json({ error: 'bad' });
  state.weeks[weekKey] = state.weeks[weekKey] || [];
  state.weeks[weekKey] = state.weeks[weekKey].concat(tasks);
  save(state);
  res.json({ ok: true, count: tasks.length });
});

// 静态前端
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Weekly tasks server listening on ' + PORT));
