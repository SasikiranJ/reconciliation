import bunyan from 'bunyan';

const logger = bunyan.createLogger({
  name: 'bitespeed-identity-reconciliation',
  level: (process.env.LOG_LEVEL as bunyan.LogLevel) || 'info',
  serializers: bunyan.stdSerializers,
  streams: [
    {
      level: 'info',
      stream: process.stdout,
    },
    {
      level: 'error',
      stream: process.stderr,
    },
  ],
});

export default logger;
