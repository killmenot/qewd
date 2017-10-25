'use strict';

module.exports = (mockery, boot, config = {}) => {
  const noop = () => null;
  const onAfterStarted = config.onAfterStarted || noop;
  const onSuccess = config.onSuccess || noop;

  const revert = (obj) => {
    obj.__revert__();
    delete obj.__revert__;
  };
  const poolPreforkFactory = (params) => Object.assign({
    poolPrefork: config.poolPrefork
  }, params);

  describe('start server module', () => {
    let qewd = null;
    let master = null;
    let qx = null;
    let masterExpress = null;

    let https = null;
    let socketio = null;
    let sockets = null;
    let fsMock = null;

    beforeEach((done) => {
      boot((_qewd, _master, _qx, _masterExpress) => {
        qewd = _qewd;
        master = _master;
        qx = _qx;
        masterExpress = _masterExpress;

        https = jasmine.createSpyObj(['createServer']);
        mockery.registerMock('https', https);

        socketio = jasmine.createSpy();
        mockery.registerMock('socket.io', socketio);

        fsMock = jasmine.createSpyObj(['readFileSync']);
        fsMock.__revert__ = qewd.__set__('fs', fsMock);

        sockets = jasmine.createSpy();
        sockets.__revert__ = qewd.__set__('sockets', sockets);

        done();
      });
    });

    afterEach(() => {
      revert(fsMock);
      revert(sockets);
    });

    it('should be able to start http server', () => {
      const server = jasmine.createSpyObj(['foo', 'bar']);
      const app = jasmine.createSpyObj(['listen']);
      app.listen.and.returnValue(server);
      masterExpress.and.returnValue(app);

      const params = poolPreforkFactory({
        no_sockets: true
      });
      const routes = null;

      qewd.start(params, routes);
      master.emit('started');
      onAfterStarted();

      expect(masterExpress).toHaveBeenCalledWith(jasmine.any(Object), routes, master, qx);
      expect(app.listen).toHaveBeenCalledWith(8080);
      expect(master.on).toHaveBeenCalledWith('response', jasmine.any(Function));

      onSuccess();
    });

    it('should be able to start https server', () => {
      const app = jasmine.createSpyObj(['listen']);
      masterExpress.and.returnValue(app);

      const server = jasmine.createSpyObj(['foo', 'bar']);
      https.createServer.and.returnValue(app);
      app.listen.and.returnValue(server);

      fsMock.readFileSync.and.returnValues('keyContent', 'certContent');

      const params = poolPreforkFactory({
        no_sockets: true,
        ssl: {
          keyFilePath: '/path/to/key/file',
          certFilePath: '/path/to/cert/file'
        }
      });
      const routes = null;

      qewd.start(params, routes);
      master.emit('started');
      onAfterStarted();

      expect(masterExpress).toHaveBeenCalledWith(jasmine.any(Object), routes, master, qx);
      expect(fsMock.readFileSync).toHaveBeenCalledTimes(2);
      expect(fsMock.readFileSync).toHaveBeenCalledWith('/path/to/key/file');
      expect(fsMock.readFileSync).toHaveBeenCalledWith('/path/to/cert/file');
      expect(https.createServer).toHaveBeenCalledWith({
        key: 'keyContent',
        cert: 'certContent'
      }, app);
      expect(app.listen).toHaveBeenCalledWith(8080);
      expect(master.on).toHaveBeenCalledWith('response', jasmine.any(Function));

      onSuccess();
    });

    describe('web sockets', () => {
      it('should be able to start websocket server', () => {
        const server = jasmine.createSpyObj(['foo']);
        const app = jasmine.createSpyObj(['listen']);
        app.listen.and.returnValue(server);
        masterExpress.and.returnValue(app);

        const io = jasmine.createSpyObj(['bar']);
        socketio.and.returnValue(io);

        const params = poolPreforkFactory({
          customSocketModule: 'foo/bar'
        });
        const routes = null;

        qewd.start(params, routes);
        master.emit('started');
        onAfterStarted();

        expect(masterExpress).toHaveBeenCalledWith(jasmine.any(Object), routes, master, qx);
        expect(socketio).toHaveBeenCalledWith(server, {
          wsEngine: 'ws'
        });
        expect(sockets).toHaveBeenCalledWith(master, io, 'foo/bar');

        onSuccess();
      });

      it('should be able to start websocket server with custom engine', () => {
        const server = jasmine.createSpyObj(['foo']);
        const app = jasmine.createSpyObj(['listen']);
        app.listen.and.returnValue(server);
        masterExpress.and.returnValue(app);

        const io = jasmine.createSpyObj(['bar']);
        socketio.and.returnValue(io);

        const params = poolPreforkFactory({
          webSockets: {
            engine: 'uws'
          }
        });
        const routes = null;

        qewd.start(params, routes);
        master.emit('started');
        onAfterStarted();

        expect(masterExpress).toHaveBeenCalledWith(jasmine.any(Object), routes, master, qx);
        expect(socketio).toHaveBeenCalledWith(server, {
          wsEngine: 'uws'
        });
        expect(sockets).toHaveBeenCalledWith(master, io, false);

        onSuccess();
      });
    });

    describe('intermediate messages', () => {
      it('should handle message', () => {
        const server = jasmine.createSpyObj(['foo']);
        const app = jasmine.createSpyObj(['listen']);
        app.listen.and.returnValue(server);
        masterExpress.and.returnValue(app);

        const io = jasmine.createSpyObj(['to', 'emit']);
        io.to.and.returnValue(io);
        socketio.and.returnValue(io);

        const params = poolPreforkFactory({
          customSocketModule: 'foo/bar'
        });
        const routes = null;

        qewd.start(params, routes);
        master.emit('started');
        onAfterStarted();

        const messageObj = {
          socketId: '/#yf_vd-S9Q7e-LX28AAAS',
          finished: false,
          foo: 'bar'
        };
        master.emit('response', messageObj);

        expect(io.to).toHaveBeenCalledWith('/#yf_vd-S9Q7e-LX28AAAS');
        expect(io.emit).toHaveBeenCalledWith('ewdjs', {
          foo: 'bar'
        });
      });

      it('should not handle message', () => {
        const server = jasmine.createSpyObj(['foo']);
        const app = jasmine.createSpyObj(['listen']);
        app.listen.and.returnValue(server);
        masterExpress.and.returnValue(app);

        const io = jasmine.createSpyObj(['to', 'emit']);
        socketio.and.returnValue(io);

        const params = poolPreforkFactory({
          customSocketModule: 'foo/bar'
        });
        const routes = null;

        qewd.start(params, routes);
        master.emit('started');
        onAfterStarted();

        const messageObj = {};
        master.emit('response', messageObj);

        expect(io.to).not.toHaveBeenCalled();
        expect(io.emit).not.toHaveBeenCalled();
      });
    });
  });
};
