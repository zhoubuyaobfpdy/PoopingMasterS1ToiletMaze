// ============================================================
// 厕所迷宫 · 排行榜服务端
// 零依赖，仅使用 Node.js 内置模块
// ============================================================

const http = require('http');
const fs = require('fs');
const path = require('path');


// Render 会提供 PORT
// 本地运行时使用 8765
const PORT = process.env.PORT || 8765;

const BASE_DIR = __dirname;


// ---- 内存数据库 ----

let scores = [];


// ---- 工具函数 ----

function getMime(filePath) {

  const ext =
    path.extname(filePath).toLowerCase();

  const map = {

    '.html':
      'text/html; charset=utf-8',

    '.js':
      'application/javascript; charset=utf-8',

    '.css':
      'text/css; charset=utf-8',

    '.json':
      'application/json; charset=utf-8',

    '.png':
      'image/png',

    '.jpg':
      'image/jpeg',

    '.jpeg':
      'image/jpeg',

    '.gif':
      'image/gif',

    '.svg':
      'image/svg+xml',

    '.ico':
      'image/x-icon',

  };

  return (
    map[ext] ||
    'application/octet-stream'
  );

}


function sendFile(
  res,
  filePath
) {

  const fullPath =
    path.join(
      BASE_DIR,
      filePath
    );

  fs.readFile(
    fullPath,
    (err, data) => {

      if (err) {

        res.writeHead(
          404,
          {
            'Content-Type':
              'text/plain; charset=utf-8'
          }
        );

        res.end(
          '404 Not Found: ' +
          filePath
        );

        return;

      }

      res.writeHead(
        200,
        {
          'Content-Type':
            getMime(filePath)
        }
      );

      res.end(data);

    }
  );

}


function sendJSON(
  res,
  obj,
  status
) {

  res.writeHead(
    status || 200,
    {
      'Content-Type':
        'application/json; charset=utf-8'
    }
  );

  res.end(
    JSON.stringify(obj)
  );

}


function readBody(req) {

  return new Promise(
    (resolve) => {

      let body = '';

      req.on(
        'data',
        chunk => {
          body += chunk;
        }
      );

      req.on(
        'end',
        () => {

          try {

            resolve(
              JSON.parse(body)
            );

          } catch {

            resolve(null);

          }

        }
      );

    }
  );

}


// ============================================================
// 排行榜
// ============================================================

function getLeaderboard() {

  return scores
    .slice()
    .sort(
      (a, b) => {

        // 成功次数少 → 排名高

        if (
          a.successAttempts !==
          b.successAttempts
        ) {

          return (
            a.successAttempts -
            b.successAttempts
          );

        }

        // 星星多 → 排名高

        if (
          a.stars !== b.stars
        ) {

          return (
            b.stars -
            a.stars
          );

        }

        // 先上榜 → 排名高

        return (
          a.timestamp -
          b.timestamp
        );

      }
    );

}


// ============================================================
// SERVER
// ============================================================

const server =
  http.createServer(
    async (req, res) => {

      // CORS

      res.setHeader(
        'Access-Control-Allow-Origin',
        '*'
      );

      res.setHeader(
        'Access-Control-Allow-Methods',
        'GET, POST, OPTIONS'
      );

      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type'
      );


      // OPTIONS

      if (
        req.method === 'OPTIONS'
      ) {

        res.writeHead(204);

        res.end();

        return;

      }


      const url =
        new URL(
          req.url,
          'http://localhost:' +
          PORT
        );

      const pathname =
        url.pathname;


      // ======================================================
      // 提交成绩
      // ======================================================

      if (
        pathname === '/api/submit' &&
        req.method === 'POST'
      ) {

        const body =
          await readBody(req);


        if (
          !body ||
          !body.name
        ) {

          sendJSON(
            res,
            {
              ok: false,
              error: 'missing name'
            },
            400
          );

          return;

        }


        const name =
          String(body.name)
            .trim()
            .slice(0, 20) ||
          '匿名玩家';


        const win =
          !!body.win;


        const stars =
          Math.max(
            0,
            Math.min(
              3,
              parseInt(
                body.stars
              ) || 0
            )
          );


        // 查找玩家

        let record =
          scores.find(
            s =>
              s.name === name
          );


        // 新玩家

        if (!record) {

          record = {

            name,

            totalAttempts: 0,

            successAttempts: 0,

            stars: 0,

            bestStars: 0,

            timestamp:
              Date.now(),

          };

          scores.push(record);

        }


        // 尝试 +1

        record.totalAttempts++;


        // 成功

        if (win) {

          record.successAttempts++;

          record.stars =
            Math.max(
              record.stars,
              stars
            );

        }


        record.bestStars =
          Math.max(
            record.bestStars || 0,
            stars
          );


        record.timestamp =
          Date.now();


        console.log(
          `[SCORE] ${name}: ` +
          `attempt ${record.totalAttempts}, ` +
          `success ${record.successAttempts}, ` +
          `stars ${stars}, ` +
          `win=${win}`
        );


        sendJSON(
          res,
          {
            ok: true,
            record
          }
        );

        return;

      }


      // ======================================================
      // 获取排行榜
      // ======================================================

      if (
        pathname ===
          '/api/leaderboard' &&
        req.method === 'GET'
      ) {

        sendJSON(
          res,
          {
            leaderboard:
              getLeaderboard()
          }
        );

        return;

      }


      // ======================================================
      // 游戏页面
      // ======================================================

      if (
        pathname === '/' ||
        pathname === '/index.html'
      ) {

        sendFile(
          res,
          'toilet_maze.html'
        );

        return;

      }


      // ======================================================
      // 排行榜页面
      // ======================================================

      if (
        pathname === '/leaderboard' ||
        pathname === '/leaderboard.html'
      ) {

        sendFile(
          res,
          'leaderboard.html'
        );

        return;

      }


      // ======================================================
      // 静态文件
      // ======================================================

      sendFile(
        res,
        pathname
      );

    }
  );


// ============================================================
// 启动
// ============================================================

server.listen(
  PORT,
  '0.0.0.0',
  () => {

    console.log(
      '================================='
    );

    console.log(
      '  厕所迷宫 · 排行榜服务已启动'
    );

    console.log(
      '================================='
    );

    console.log(
      '  Port: ' + PORT
    );

  }
);
