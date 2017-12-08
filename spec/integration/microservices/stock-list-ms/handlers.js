'use strict';

const router = require('qewd-router');

function getStockList(args, finished) {
  const stockListObj = {
    store: args.destination,
    ip: '127.0.0.1:8082',
    stock: 'stock list here...'
  };
  finished(stockListObj);
}

function getStockListByCategory(args, finished) {
  const stockListObj = {
    store: args.destination,
    ip: '127.0.0.1:8082',
    category: args.category,
    stock: 'stock list for ' + args.category + ' here...'
  };
  finished(stockListObj);
}

module.exports = {

  init: function () {
    const routes = {
      '/api/store/all/stocklist': {
        GET: getStockList
      },
      '/api/store/:destination/stocklist': {
        GET: getStockList
      },
      '/api/store/all/category/:category/stocklist': {
        GET: getStockListByCategory
      },
      '/api/store/:destination/category/:category/stocklist': {
        GET: getStockListByCategory
      }
    };
    router.addMicroServiceHandler(routes, module.exports);
  },

  beforeMicroServiceHandler: function (req, finished) {
    return this.jwt.handlers.validateRestRequest.call(this, req, finished);
  }

};
