import { exec } from 'child_process';

const port = 3001;

const isWin = process.platform === 'win32';

const cmd = isWin ? `netstat -ano | findstr :${port}` : `lsof -ti :${port}`;

exec(cmd, (err, stdout) => {
  if (err || !stdout) {
    console.log(`No process found on port ${port}`);
    return;
  }

  const pids = isWin
    ? stdout
        .split('\n')
        .map((line) => line.trim().split(/\s+/).pop())
        .filter(Boolean)
    : stdout.split('\n').filter(Boolean);

  const uniquePids = [...new Set(pids)];

  uniquePids.forEach((pid) => {
    const killCmd = isWin ? `taskkill /PID ${pid} /F` : `kill -9 ${pid}`;

    exec(killCmd, () => {
      console.log(`Killed PID ${pid}`);
    });
  });
});
