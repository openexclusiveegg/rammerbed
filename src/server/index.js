//require('dotenv-flow').config();

const exitHook = require('async-exit-hook');
const RammerheadProxy = require('../classes/RammerheadProxy');
const addStaticDirToProxy = require('../util/addStaticDirToProxy');
const RammerheadSessionFileCache = require('../classes/RammerheadSessionFileCache');
const config = require('../config');
const setupRoutes = require('./setupRoutes');
const setupPipeline = require('./setupPipeline');
const RammerheadLogging = require('../classes/RammerheadLogging');

if (config.reverseProxy) {
    config.getServerInfo = (req) => {
        return { hostname: new URL('http://' + req.headers.host).hostname, port: 200, crossDomainPort: 200, protocol: 'https:' };
    }
}

const logger = new RammerheadLogging({
    logLevel: config.logLevel,
    generatePrefix: config.generatePrefix
});

const proxyServer = new RammerheadProxy({
    logger,
    loggerGetIP: config.getIP,
    bindingAddress: config.bindingAddress,
    port: config.port,
    crossDomainPort: config.crossDomainPort,
    ssl: config.ssl,
    getServerInfo: config.getServerInfo,
    disableLocalStorageSync: config.disableLocalStorageSync
});

if (config.publicDir) addStaticDirToProxy(proxyServer, config.publicDir);

const sessionStore = new RammerheadSessionFileCache({ logger, ...config.fileCacheSessionConfig });
sessionStore.attachToProxy(proxyServer);

setupPipeline(proxyServer, sessionStore);
setupRoutes(proxyServer, sessionStore, logger);

// nicely close proxy server and save sessions to store before we exit
exitHook(() => {
    logger.info(`(server) Received exit signal, closing proxy server`);
    proxyServer.close();
    logger.info('(server) Closed proxy server');
});

const formatUrl = (secure, hostname, port) => `${secure ? 'https' : 'http'}://${hostname}:${port}`;
logger.info(`(server) Rammerhead proxy is listening on ${formatUrl(config.ssl, config.bindingAddress, config.port)}`);
