import * as alphaTab from "@coderline/alphatab";
import { inspectScore, describeBeat } from "./score-summary";
import "./style.css";

const files = Object.entries(
  import.meta.glob("../../gps/*.gp", {
    query: "?url",
    import: "default",
    eager: true,
  }),
).map(([path, url]) => ({ name: path.split("/").pop()!, url: url as string }));
const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const version = "1.8.4";
document.querySelector("#app")!.innerHTML = `
  <header class="topbar"><a class="brand" href="/" aria-label="六线谱实验室首页"><span class="brand-icon">≋</span> tab-omr <span class="brand-sub">/ 六线谱实验室</span></a><span class="local-badge"><i></i> 本地演示</span></header>
  <main>
    <section class="intro"><div><p class="eyebrow">EXPERIMENT 01 · 从谱文件到声音</p><h1>让谱子，先响起来。</h1><p class="intro-copy">用现有 Guitar Pro 乐谱验证显示、播放与结构化数据。图片识别将在这条管线之上接入。</p></div><div class="flow" aria-label="当前流程"><span>GP 文件</span><b>→</b><span>谱面数据</span><b>→</b><span class="flow-end">显示 / 试听 / 导出</span></div></section>
    <div class="workspace">
      <aside class="sidebar">
        <div class="section-label">本地曲谱 <span id="file-count"></span></div><div id="library" class="library"></div>
        <label class="upload">＋ 打开自己的谱文件<input id="file" type="file" accept=".gp,.gp3,.gp4,.gp5,.gpx,.xml,.musicxml,.mxl,.json" /></label>
        <p class="aside-note">文件在浏览器本地解析。JSON 仅支持本页导出的 alphaTab ${version} 格式。</p>
        <div class="sidebar-bottom"><span class="mini-label">这一步验证什么？</span><p>读取时值、弦位和技法，让同一份谱数据驱动谱面与声音。</p><a href="https://alphatab.net/docs/introduction/" target="_blank" rel="noreferrer">由 alphaTab 驱动 ↗</a></div>
      </aside>
      <section class="score-panel" aria-label="乐谱与播放器">
        <div class="score-heading"><div><p class="eyebrow">SCORE PREVIEW</p><h2 id="song-title">选择一份曲谱</h2><p id="song-context" class="muted">正在初始化…</p></div><span id="render-status" class="status" role="status" aria-live="polite">准备中</span></div>
        <div class="controls"><div class="transport"><button id="play" class="primary" disabled>▶ 播放</button><button id="stop" disabled>■ 停止</button><span id="position" class="position">00:00 / 00:00</span></div><div class="view-controls"><label>速度 <select id="speed" aria-label="播放速度"><option value="0.5">0.5×</option><option value="0.75">0.75×</option><option value="1" selected>1×</option><option value="1.25">1.25×</option></select></label><label>谱面 <select id="view" aria-label="谱面显示方式"><option value="3">六线谱</option><option value="1">五线谱 + 六线谱</option></select></label></div></div>
        <div class="audio-line"><span id="audio-status" role="status">正在加载音色…</span><span>点击谱面可定位并查看音符数据</span></div>
        <p id="error" class="error" role="alert" hidden></p>
        <div id="score-scroll" class="score-scroll"><div id="score"></div></div>
      </section>
      <aside class="inspector" aria-label="谱面数据检查器"><div class="section-label">谱面数据 <span class="data-dot"></span></div>
        <div class="stats"><div><strong id="bars">—</strong><span>小节</span></div><div><strong id="notes">—</strong><span>音符出现</span></div></div>
        <div class="inspector-section"><h3>读取到的技法</h3><div id="techniques" class="tags"><span class="muted">等待载入</span></div></div>
        <div class="inspector-section"><h3 id="event-title">事件检查</h3><p class="muted small">点击谱面上的音符，查看对应数据。弦号 1 表示最高音弦。</p><pre id="event-data">尚未选择音符</pre></div>
        <div class="inspector-section exports"><h3>导出与往返验证</h3><button id="json" disabled>↓ 导出谱数据 JSON</button><button id="gp" disabled>↓ 导出 Guitar Pro</button><button id="midi" disabled>↓ 导出 MIDI</button><button id="roundtrip" disabled>↻ 从 JSON 重新载入</button><p class="muted small">JSON 是锁定版本的诊断数据，尚未转换为训练标注格式。MIDI 不保留完整弦位与技法。</p></div>
      </aside>
    </div>
    <footer><span>GP → 数据 → 谱面与声音</span><span>本阶段：组件验证 · 尚未接入图片识别</span></footer>
  </main>`;

const api = new alphaTab.AlphaTabApi($("score"), {
  core: { fontDirectory: "/font/", engine: "svg" },
  display: { staveProfile: alphaTab.StaveProfile.Tab, scale: 0.95 },
  player: {
    enablePlayer: true,
    soundFont: "/soundfont/sonivox.sf2",
    scrollElement: "#score-scroll",
  },
});
let currentName = "";
let requestId = 0;
let busy = false;
let hasScore = false;
const exportIds = ["json", "gp", "midi", "roundtrip"];

function fail(message: string) {
  $("error").textContent = message;
  $("error").hidden = false;
}
function refreshControls() {
  ($("play") as HTMLButtonElement).disabled =
    busy || !hasScore || !api.isReadyForPlayback;
  ($("stop") as HTMLButtonElement).disabled =
    busy || !hasScore || !api.isReadyForPlayback;
  for (const id of exportIds)
    $<HTMLButtonElement>(id).disabled = busy || !hasScore;
  $<HTMLSelectElement>("view").disabled = busy || !hasScore;
}
function startLoad(name: string) {
  api.stop();
  busy = true;
  hasScore = false;
  $("score").style.visibility = "hidden";
  $("bars").textContent = "—";
  $("notes").textContent = "—";
  $("techniques").textContent = "等待载入";
  $("error").hidden = true;
  $("render-status").textContent = "读取中";
  $("song-title").textContent = name.replace(/\.[^.]+$/, "");
  $("song-context").textContent = "正在解析谱面数据…";
  $("event-title").textContent = "事件检查";
  $("event-data").textContent = "尚未选择音符";
  $("position").textContent = "00:00 / 00:00";
  currentName = name;
  refreshControls();
}
function displayScore(score: alphaTab.model.Score) {
  api.renderScore(
    score,
    score.tracks.map((_, i) => i),
  );
}
async function openScore(name: string, read: () => Promise<ArrayBuffer>) {
  const id = ++requestId;
  startLoad(name);
  try {
    const buffer = await read();
    if (id !== requestId) return;
    let score: alphaTab.model.Score;
    if (/\.json$/i.test(name)) {
      const envelope = JSON.parse(new TextDecoder().decode(buffer));
      if (
        envelope.format !== "tab-omr-alphatab-diagnostic" ||
        envelope.alphaTabVersion !== version ||
        !envelope.score
      ) {
        throw new Error(`请打开本页导出的 alphaTab ${version} JSON 文件。`);
      }
      score = alphaTab.model.JsonConverter.jsObjectToScore(
        envelope.score,
        api.settings,
      );
    } else {
      score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(
        new Uint8Array(buffer),
        api.settings,
      );
    }
    if (!score.masterBars.length || !score.tracks.length)
      throw new Error("谱文件没有可显示的轨道或小节。");
    displayScore(score);
  } catch (error) {
    if (id !== requestId) return;
    busy = false;
    $("render-status").textContent = "读取失败";
    $("song-context").textContent = "请选择其他曲谱，或检查文件格式。";
    fail(error instanceof Error ? error.message : String(error));
    refreshControls();
  }
}

api.scoreLoaded.on((score) => {
  hasScore = true;
  const data = inspectScore(score);
  $("bars").textContent = String(data.bars);
  $("notes").textContent = data.notes.toLocaleString();
  const context = score.tracks.flatMap((track) =>
    track.staves.map(
      (staff) =>
        `${track.name || "吉他"} · 调弦 ${staff.tuning.join(" / ")} MIDI · 变调夹 ${staff.capo} 品`,
    ),
  );
  $("song-context").textContent = `${score.tempo} BPM · ${context.join("；")}`;
  const tags = $("techniques");
  tags.replaceChildren();
  for (const [name, count] of Object.entries(data.techniques)) {
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = `${name} ${count}`;
    tags.append(tag);
  }
  if (!tags.children.length) tags.textContent = "未检测到已统计的技法";
  const beat = score.tracks
    .flatMap((t) =>
      t.staves.flatMap((s) =>
        s.bars.flatMap((b) => b.voices.flatMap((v) => v.beats)),
      ),
    )
    .find((b) => !b.isEmpty);
  if (beat) showBeat(beat);
});
api.postRenderFinished.on(() => {
  busy = false;
  $("score").style.visibility = hasScore ? "visible" : "hidden";
  $("render-status").textContent = hasScore ? "已显示" : "等待曲谱";
  refreshControls();
});
api.error.on((error) => {
  busy = false;
  $("render-status").textContent = "发生错误";
  fail(error.message);
  refreshControls();
});
api.soundFontLoad.on((event) => {
  $("audio-status").textContent = event.total
    ? `音色加载 ${Math.round((event.loaded / event.total) * 100)}%`
    : "正在加载音色…";
});
api.playerReady.on(() => {
  $("audio-status").textContent = "音色已就绪 · 点击播放即可试听";
  refreshControls();
});
api.playerStateChanged.on((event) => {
  $("play").textContent =
    event.state === alphaTab.synth.PlayerState.Playing ? "Ⅱ 暂停" : "▶ 播放";
});
const clock = (ms: number) =>
  `${Math.floor(ms / 60000)
    .toString()
    .padStart(2, "0")}:${Math.floor((ms / 1000) % 60)
    .toString()
    .padStart(2, "0")}`;
api.playerPositionChanged.on((event) => {
  $("position").textContent =
    `${clock(event.currentTime)} / ${clock(event.endTime)}`;
});
function showBeat(beat: alphaTab.model.Beat) {
  $("event-title").textContent =
    `第 ${beat.voice.bar.index + 1} 小节 · 声部 ${beat.voice.index + 1}`;
  $("event-data").textContent = JSON.stringify(describeBeat(beat), null, 2);
}
api.beatMouseDown.on(showBeat);
$("play").addEventListener("click", () => api.playPause());
$("stop").addEventListener("click", () => api.stop());
$("speed").addEventListener("change", () => {
  api.playbackSpeed = Number($<HTMLSelectElement>("speed").value);
});
$("view").addEventListener("change", () => {
  busy = true;
  refreshControls();
  api.settings.display.staveProfile = Number(
    $<HTMLSelectElement>("view").value,
  );
  api.updateSettings();
  api.render();
});
function download(data: BlobPart, extension: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${currentName.replace(/\.[^.]+$/, "")}.${extension}`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
$("json").addEventListener("click", () => {
  if (!api.score) return;
  const score = JSON.parse(alphaTab.model.JsonConverter.scoreToJson(api.score));
  download(
    JSON.stringify(
      {
        format: "tab-omr-alphatab-diagnostic",
        alphaTabVersion: version,
        sourceName: currentName,
        score,
      },
      null,
      2,
    ),
    "json",
    "application/json",
  );
});
$("gp").addEventListener("click", () => {
  if (!api.score) return;
  try {
    const data = new alphaTab.exporter.Gp7Exporter().export(
      api.score,
      api.settings,
    );
    download(new Uint8Array(data).buffer, "gp", "application/octet-stream");
  } catch (error) {
    fail(String(error));
  }
});
$("midi").addEventListener("click", () => api.downloadMidi());
$("roundtrip").addEventListener("click", () => {
  if (!api.score) return;
  try {
    const json = alphaTab.model.JsonConverter.scoreToJson(api.score);
    const score = alphaTab.model.JsonConverter.jsonToScore(json, api.settings);
    startLoad(currentName);
    displayScore(score);
  } catch (error) {
    busy = false;
    fail(String(error));
    refreshControls();
  }
});
$("file").addEventListener("change", () => {
  const file = $<HTMLInputElement>("file").files?.[0];
  if (!file) return;
  document
    .querySelectorAll(".song")
    .forEach((el) => el.classList.remove("active"));
  void openScore(file.name, () => file.arrayBuffer());
  $<HTMLInputElement>("file").value = "";
});
$("file-count").textContent = String(files.length).padStart(2, "0");
for (const [i, file] of files.entries()) {
  const button = document.createElement("button");
  button.className = "song";
  const number = document.createElement("span");
  number.className = "song-number";
  number.textContent = String(i + 1).padStart(2, "0");
  const name = document.createElement("span");
  name.textContent = file.name.replace(/\.gp$/i, "");
  button.append(number, name);
  button.addEventListener("click", () => {
    document
      .querySelectorAll(".song")
      .forEach((el) => el.classList.remove("active"));
    button.classList.add("active");
    void openScore(file.name, async () => {
      const response = await fetch(file.url);
      if (!response.ok) throw new Error("读取本地曲谱失败");
      return response.arrayBuffer();
    });
  });
  $("library").append(button);
}
if (files.length) ($("library").firstElementChild as HTMLButtonElement).click();
else {
  busy = false;
  $("song-context").textContent = "打开自己的谱文件开始验证";
  $("render-status").textContent = "等待曲谱";
  refreshControls();
}
window.addEventListener("beforeunload", () => api.destroy());
