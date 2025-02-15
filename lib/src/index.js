'use strict';

var binary = require('node-pre-gyp');
var fse = require('fs-extra');
var path = require('path');
var binding_path = binary.find(path.resolve(path.join(__dirname, '../../', './package.json')));

var _require = require(binding_path),
    NSFW = _require.NSFW;

var _isInteger = require('lodash.isinteger');
var _isUndefined = require('lodash.isundefined');

var _private = {};

function nsfw() {
  if (!(this instanceof nsfw)) {
    return _private.buildNSFW.apply(_private, arguments);
  }

  var _nsfw = new (Function.prototype.bind.apply(NSFW, [null].concat(Array.prototype.slice.call(arguments))))();

  this.start = function start() {
    return new Promise(function (resolve, reject) {
      _nsfw.start(function (err) {
        if (err) {
          reject(err);
        }
        resolve();
      });
    });
  };

  this.stop = function stop() {
    return new Promise(function (resolve) {
      _nsfw.stop(resolve);
    });
  };
}

nsfw.actions = {
  CREATED: 0,
  DELETED: 1,
  MODIFIED: 2,
  RENAMED: 3
};

_private.buildNSFW = function buildNSFW(watchPath, eventCallback, options) {
  var _ref = options || {},
      debounceMS = _ref.debounceMS,
      errorCallback = _ref.errorCallback;

  if (_isInteger(debounceMS)) {
    if (debounceMS < 1) {
      throw new Error('Minimum debounce is 1ms.');
    }
  } else if (_isUndefined(debounceMS)) {
    debounceMS = 500;
  } else {
    throw new Error('Option debounceMS must be a positive integer greater than 1.');
  }

  if (_isUndefined(errorCallback)) {
    errorCallback = function errorCallback(nsfwError) {
      throw nsfwError;
    };
  }

  if (!path.isAbsolute(watchPath)) {
    throw new Error('Path to watch must be an absolute path.');
  }

  return fse.stat(watchPath).then(function (stats) {
    if (stats.isDirectory()) {
      return new nsfw(debounceMS, watchPath, eventCallback, errorCallback);
    } else if (stats.isFile()) {
      return new _private.nsfwFilePoller(debounceMS, watchPath, eventCallback);
    } else {
      throw new Error('Path must be a valid path to a file or a directory.');
    }
  }, function () {
    throw new Error('Path must be a valid path to a file or a directory.');
  });
};

_private.nsfwFilePoller = function (debounceMS, watchPath, eventCallback) {
  var _nsfw$actions = nsfw.actions,
      CREATED = _nsfw$actions.CREATED,
      DELETED = _nsfw$actions.DELETED,
      MODIFIED = _nsfw$actions.MODIFIED;

  var directory = path.dirname(watchPath);
  var file = path.basename(watchPath);

  var fileStatus = void 0;
  var filePollerInterval = void 0;

  function getStatus() {
    return fse.stat(watchPath).then(function (status) {
      if (fileStatus === null) {
        fileStatus = status;
        eventCallback([{ action: CREATED, directory: directory, file: file }]);
      } else if (status.mtime - fileStatus.mtime !== 0 || status.ctime - fileStatus.ctime !== 0) {
        fileStatus = status;
        eventCallback([{ action: MODIFIED, directory: directory, file: file }]);
      }
    }, function () {
      if (fileStatus !== null) {
        fileStatus = null;
        eventCallback([{ action: DELETED, directory: directory, file: file }]);
      }
    });
  }

  this.start = function start() {
    return fse.stat(watchPath).then(function (status) {
      return fileStatus = status;
    }, function () {
      return fileStatus = null;
    }).then(function () {
      filePollerInterval = setInterval(getStatus, debounceMS);
    });
  };

  this.stop = function stop() {
    return Promise.resolve().then(function () {
      return clearInterval(filePollerInterval);
    });
  };
};

module.exports = nsfw;