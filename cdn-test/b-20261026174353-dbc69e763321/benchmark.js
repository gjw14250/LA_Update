(function (root, factory) {
    var api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else { root.__LA_CDN_MISS_TEST__ = api; api.mount(root); }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    function classify(raw) {
        var parts = String(raw || '').split(',').map(function (part) { return part.trim().toUpperCase(); });
        if (!raw || !parts.length || parts.some(function (part) { return part !== 'HIT' && part !== 'MISS'; })) return 'unknown';
        if (parts.every(function (part) { return part === 'MISS'; })) return 'miss';
        if (parts.every(function (part) { return part === 'HIT'; })) return 'hit';
        return 'mixed';
    }
    function validate(plan) {
        if (!plan || plan.schemaVersion !== 1 || !/^b-[a-z0-9-]{12,48}$/.test(plan.batch || '') || !Array.isArray(plan.slots) || !Array.isArray(plan.files)) throw Error('测试配置无效');
        if (plan.slots.length < 2 || plan.slots.length > 12 || plan.files.length < 1 || plan.files.length > 16) throw Error('测试规模无效');
        var slots = {};
        plan.slots.forEach(function (slot) {
            if (!/^(?:ios|android)-[1-3]$|^qa$/.test(slot) || slots[slot]) throw Error('测试路径无效');
            slots[slot] = true;
        });
        var paths = {}, bytes = 0;
        plan.files.forEach(function (file) {
            if (!file || !/^assets\/(?:[a-z0-9-]+-res|config|resources|internal)\/[A-Za-z0-9_./-]+\.(?:json|bin|webp)$/.test(file.path || '') || file.path.indexOf('..') !== -1 || paths[file.path]) throw Error('资源路径无效');
            if (!Number.isInteger(file.bytes) || file.bytes < 1 || file.bytes > 4 * 1024 * 1024 || !/^[a-f0-9]{64}$/.test(file.sha256 || '') || typeof file.label !== 'string' || file.label.length > 60) throw Error('资源校验信息无效');
            paths[file.path] = true; bytes += file.bytes;
        });
        if (bytes !== plan.totalBytes || bytes > 12 * 1024 * 1024) throw Error('资源总量无效');
        return plan;
    }
    function sampleURL(base, plan, slot, file) {
        if (plan.slots.indexOf(slot) === -1 || plan.files.indexOf(file) === -1) throw Error('不在测试清单内');
        var url = new URL('_samples/' + slot + '/' + file.path, base);
        if (url.origin !== new URL(base).origin || url.search || url.hash) throw Error('需要同域独立路径');
        return url.href;
    }
    function statistics(rows) {
        var counts = {files:rows.length, valid:0, verifiedMiss:0, hit:0, mixed:0, unknown:0, failed:0};
        rows.forEach(function (row) {
            if (!row.checksumOK || row.status !== 200) { counts.failed++; return; }
            counts.valid++;
            if (!row.networkConfirmed || row.cache === 'unknown') counts.unknown++;
            else if (row.cache === 'miss') counts.verifiedMiss++;
            else if (row.cache === 'hit') counts.hit++;
            else counts.mixed++;
        });
        return counts;
    }
    function secs(ms) { return (ms / 1000).toFixed(2) + ' 秒'; }
    function reportText(report) {
        var lines = ['LA GitHub Pages CDN 未命中测试', '批次：' + report.batch, '路径：' + report.slot, '资源版本：' + report.resourceVersion,
            '资源：' + report.fileCount + ' 个，原始 ' + (report.totalBytes / 1048576).toFixed(2) + ' MiB；并发 ' + report.concurrency,
            '页面：' + report.page, '设备：' + report.userAgent,
            '模式：两轮均 cache=reload，绕过浏览器 HTTP 缓存；同一资源 URL 不变。',
            '范围：只测资源下载与校验，不含登录、游戏初始化、图片解码或 GPU 上传。',
            'MISS 仅指响应头报告的缓存层；不是 GitHub 全部内部缓存清空的证明。'];
        report.phases.forEach(function (phase) {
            var counts = phase.counts || statistics(phase.rows);
            lines.push('', phase.name === 'first' ? '首次请求（未命中候选）' : '同地址网络复测', '开始：' + phase.startedAt,
                '批次耗时（含校验）：' + secs(phase.elapsedMs) + (phase.stopped ? '（已停止）' : ''),
                '校验成功 ' + counts.valid + '/' + counts.files + '；已验证 MISS ' + counts.verifiedMiss + '；HIT ' + counts.hit + '；混合 ' + counts.mixed + '；未确认 ' + counts.unknown + '；失败 ' + counts.failed);
            if (phase.hidden) lines.push('页面曾进入后台，耗时可能受后台节流影响。');
            phase.rows.forEach(function (row) {
                lines.push(secs(row.downloadMs) + ' | HTTP ' + (row.status || 0) + ' | ' + row.label + ' | X-Cache=' + (row.xCache || '未提供') +
                    ' | Age=' + (row.age || '未提供') + ' | 网络传输=' + (row.networkConfirmed ? row.transferBytes + ' 字节' : '未确认') + ' | SHA-256=' + (row.checksumOK ? '一致' : '失败'));
                lines.push('  ' + row.url, '  节点=' + (row.servedBy || '未提供') + '；编码=' + (row.encoding || 'identity') + (row.error ? '；错误=' + row.error : ''));
            });
        });
        return lines.join('\n');
    }
    async function download(env, url, file, controller) {
        var start = env.performance.now(), row = {url:url, label:file.label, status:0, bytes:0, checksumOK:false, cache:'unknown', networkConfirmed:false};
        var timeout = env.setTimeout(function () { controller.abort(); }, 120000);
        try {
            var response = await env.fetch(url, {cache:'reload', credentials:'omit', redirect:'error', signal:controller.signal});
            row.status = response.status;
            row.xCache = response.headers.get('x-cache') || '';
            row.age = response.headers.get('age') || '';
            row.servedBy = response.headers.get('x-served-by') || '';
            row.cacheHits = response.headers.get('x-cache-hits') || '';
            row.encoding = response.headers.get('content-encoding') || 'identity';
            row.cacheControl = response.headers.get('cache-control') || '';
            row.cache = classify(row.xCache);
            var length = Number(response.headers.get('content-length') || 0);
            if (!response.ok || length > file.bytes + 65536) throw Error('HTTP 或响应大小异常');
            var data = await response.arrayBuffer();
            row.downloadMs = env.performance.now() - start; row.bytes = data.byteLength;
            var timings = env.performance.getEntriesByName(url, 'resource');
            var timing = timings[timings.length - 1];
            if (timing) {
                row.transferBytes = timing.transferSize;
                row.encodedBytes = timing.encodedBodySize;
                row.workerStart = timing.workerStart;
                row.deliveryType = timing.deliveryType || '';
                row.networkConfirmed = timing.startTime >= start - 1 && timing.transferSize > 0 && !timing.workerStart && timing.deliveryType !== 'cache';
            }
            if (data.byteLength !== file.bytes) throw Error('资源大小不一致');
            var digest = new Uint8Array(await env.crypto.subtle.digest('SHA-256', data)), hex = '';
            for (var i = 0; i < digest.length; i++) hex += ('0' + digest[i].toString(16)).slice(-2);
            row.checksumOK = hex === file.sha256;
            if (!row.checksumOK) throw Error('SHA-256 不一致');
        } catch (error) {
            row.error = error.name === 'AbortError' ? '停止或请求超过 120 秒' : String(error.message).slice(0,160);
        } finally {
            env.clearTimeout(timeout);
            if (row.downloadMs === undefined) row.downloadMs = env.performance.now() - start;
        }
        return row;
    }
    function mount(env) {
        var doc = env.document, ui = {};
        ['plan','slot','history','first','repeat','stop','progress','status','results','comparison','rows','copy','export','report','slots'].forEach(function (id) { ui[id] = doc.getElementById(id); });
        var base = new URL('./', env.location.href).href, plan, report, busy = false, stopped = false, controllers = [];
        var key;
        function save() { try { env.localStorage.setItem(key, JSON.stringify(report)); } catch (_) {} }
        function render() {
            ui.results.hidden = !report.phases.length;
            ui.report.value = reportText(report);
            ui.rows.textContent = '';
            var summaries = [];
            report.phases.forEach(function (phase) {
                var counts = statistics(phase.rows);
                summaries.push((phase.name === 'first' ? '首次请求' : '同地址复测') + '：' + secs(phase.elapsedMs) + '；MISS ' + counts.verifiedMiss + '，HIT ' + counts.hit + '，混合 ' + counts.mixed + '，未确认 ' + counts.unknown + '，失败 ' + counts.failed);
                phase.rows.forEach(function (row) {
                    var tr = doc.createElement('tr');
                    [row.label, phase.name === 'first' ? '首次' : '复测', secs(row.downloadMs), row.xCache || '未提供', row.networkConfirmed ? '有' : '不足'].forEach(function (value) {
                        var td = doc.createElement('td'); td.textContent = value; tr.appendChild(td);
                    });
                    ui.rows.appendChild(tr);
                });
            });
            ui.comparison.textContent = summaries.join('\n');
            ui.first.disabled = busy || report.phases.length > 0;
            ui.repeat.disabled = busy || report.phases.length !== 1 || report.phases[0].rows.length !== plan.files.length || statistics(report.phases[0].rows).failed > 0;
            ui.stop.disabled = !busy;
            ui.slot.disabled = busy;
        }
        async function run(name) {
            if (busy || report.phases.length !== (name === 'first' ? 0 : 1)) return;
            if (env.navigator.serviceWorker && env.navigator.serviceWorker.controller) { ui.status.textContent = '当前页面由 Service Worker 控制，无法排除本地拦截，本次不开始测试。'; return; }
            busy = true; stopped = false; controllers = [];
            var phase = {name:name, startedAt:new Date().toISOString(), elapsedMs:0, rows:[], hidden:doc.visibilityState !== 'visible'};
            report.phases.push(phase); save(); render();
            var cursor = 0, started = env.performance.now(), hidden = function () { if (doc.visibilityState !== 'visible') phase.hidden = true; };
            doc.addEventListener('visibilitychange', hidden);
            ui.progress.max = plan.files.length; ui.progress.value = 0;
            var timer = env.setInterval(function () { ui.status.textContent = '正在' + (name === 'first' ? '首次下载' : '同地址复测') + '：' + phase.rows.length + '/' + plan.files.length + '，已用 ' + secs(env.performance.now() - started); }, 250);
            try {
                async function worker() {
                    while (!stopped && cursor < plan.files.length) {
                        var file = plan.files[cursor++], controller = new env.AbortController();
                        controllers.push(controller);
                        var row = await download(env, sampleURL(base, plan, report.slot, file), file, controller);
                        phase.rows.push(row); phase.elapsedMs = env.performance.now() - started;
                        phase.counts = statistics(phase.rows); ui.progress.value = phase.rows.length;
                        save(); render();
                    }
                }
                var workers = [];
                for (var i = 0; i < report.concurrency; i++) workers.push(worker());
                await Promise.all(workers);
            } finally {
                env.clearInterval(timer); doc.removeEventListener('visibilitychange', hidden);
                phase.elapsedMs = env.performance.now() - started; phase.stopped = stopped; phase.counts = statistics(phase.rows);
                busy = false; controllers = []; save(); render();
                ui.status.textContent = stopped ? '测试已停止，已保留现有结果；重新测试请换一套独立路径。' : '本轮完成。' + (name === 'first' && phase.counts.failed === 0 ? '接着点击“同地址网络复测”作对照。' : '可以复制报告。');
            }
        }
        ui.first.addEventListener('click', function () { run('first').catch(function () { ui.status.textContent = '测试中断，请复制当前报告。'; }); });
        ui.repeat.addEventListener('click', function () { run('repeat').catch(function () { ui.status.textContent = '测试中断，请复制当前报告。'; }); });
        ui.stop.addEventListener('click', function () { stopped = true; controllers.forEach(function (controller) { controller.abort(); }); });
        ui.slot.addEventListener('change', function () { var url = new URL(base); url.searchParams.set('slot', ui.slot.value); env.location.assign(url.href); });
        ui.copy.addEventListener('click', function () {
            var text = reportText(report);
            if (env.navigator.clipboard && env.navigator.clipboard.writeText) env.navigator.clipboard.writeText(text).then(function () { ui.status.textContent = '已复制报告'; }, select);
            else select();
            function select() { ui.report.parentNode.open = true; ui.report.focus(); ui.report.select(); try { doc.execCommand('copy'); } catch (_) {} ui.status.textContent = '报告已选中，可长按复制'; }
        });
        ui.export.addEventListener('click', function () {
            var url = env.URL.createObjectURL(new env.Blob([JSON.stringify(report,null,2)], {type:'application/json'})), link = doc.createElement('a');
            link.href = url; link.download = 'la-cdn-' + plan.batch + '-' + report.slot + '.json'; doc.body.appendChild(link); link.click(); link.remove(); env.setTimeout(function () { env.URL.revokeObjectURL(url); },1000);
        });
        if (!env.crypto || !env.crypto.subtle || !env.AbortController || !env.performance || !env.performance.getEntriesByName) { ui.status.textContent = '当前浏览器缺少校验或网络计时能力，请使用较新的 Safari、Chrome 或 Edge。'; return; }
        env.fetch(new URL('plan.json',base).href,{cache:'reload',credentials:'omit',redirect:'error'}).then(function (response) {
            if (!response.ok) throw Error('HTTP ' + response.status);
            return response.json();
        }).then(function (value) {
            plan = validate(value);
            var slot = new URLSearchParams(env.location.search).get('slot') || 'ios-1';
            if (plan.slots.indexOf(slot) === -1) throw Error('没有这套测试路径');
            key = 'la-cdn-miss:' + plan.batch + ':' + slot;
            report = {schemaVersion:1, batch:plan.batch, slot:slot, resourceVersion:plan.resourceVersion, fileCount:plan.files.length, totalBytes:plan.totalBytes, concurrency:3,
                page:new URL('./',base).href + '?slot=' + slot, userAgent:env.navigator.userAgent, phases:[]};
            try {
                var previous = JSON.parse(env.localStorage.getItem(key));
                if (previous && previous.batch === plan.batch && previous.slot === slot && Array.isArray(previous.phases) && previous.phases.length > 0 && previous.phases.length <= 2 && previous.phases.every(function (phase) { return Array.isArray(phase.rows) && phase.rows.length <= plan.files.length; })) {
                    report = previous; ui.history.textContent = '本浏览器已经使用过这套路径，下面保留上次结果。要测试新的首次请求，请换其他路径。';
                }
            } catch (_) {}
            plan.slots.forEach(function (item) {
                if (item === 'qa' && slot !== 'qa') return;
                var option = doc.createElement('option'); option.value = item; option.textContent = item; ui.slot.appendChild(option);
                if (item !== 'qa') { var link = doc.createElement('a'), url = new URL(base); url.searchParams.set('slot',item); link.href = url.href; link.textContent = item; ui.slots.appendChild(link); }
            });
            ui.slot.value = slot;
            ui.plan.textContent = '批次 ' + plan.batch + '；' + plan.files.length + ' 个现用首屏资源副本，原始 ' + (plan.totalBytes / 1048576).toFixed(2) + ' MiB；完成两轮约需下载两份资源。';
            render(); ui.status.textContent = report.phases.length ? '已恢复本浏览器保存的测试结果。' : '准备完成，点击“首次下载”开始。';
            env.__LA_CDN_REPORT__ = function () { return JSON.parse(JSON.stringify(report)); };
        }).catch(function (error) { ui.status.textContent = '配置加载失败：' + error.message; });
    }
    return {classify:classify,validate:validate,sampleURL:sampleURL,statistics:statistics,reportText:reportText,download:download,mount:mount};
});
