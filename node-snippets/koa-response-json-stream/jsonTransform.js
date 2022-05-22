const util = require('util');
const Transform = require('stream').Transform;
const event = require('events');

class Writer extends event.EventEmitter {
  constructor (stream, counter) {
    super()
    this.count = 0
    this.cache = ''
    this.stream = stream
    this.counter = counter
    this.ended = false

    this.on('parsedEnd', () => {
      this.ended = true
      // json 转换完毕最后，处理半包写入剩余的内容
      this._write()
    })
  }
  _wait () {
    return new Promise(resolve => {
      this.stream.once('data', () => {
        resolve()
      })
      // 16.* 版本以上可使用该，低版本该事件不会触发
      // this.stream.once('resume', () => {
      //   resolve()
      // })
    })
  }
  async _write () {
    try {
      /*
       * 默认 WritableStream 的 highWarterMark 为 16kb，此处为避免触发 highWarterMark 致使直接返回 false，
       * 因此每次积累到超过 8k 后才写入。
       */
      while (this.cache.length > (1 << 13)) {
        const writeBuf = this.cache.slice(0, 1 << 13)
        this.cache = this.cache.slice(1 << 13)
        const res = this.stream.write(writeBuf)
        /**
         * 触发被压反馈机制，表明暂时无法向流写入数据，等待触发 resume 或 data 事件后，方可再次写入
         */
        if (!res) {
          await this._wait()
        }
        this.count -= 1 << 13
      }
      if (this.ended) {
        // write remain
        this.stream.write(this.cache)
      }
    } catch (err) {
      console.log('[Writer] [_write] error: ', err)
    }
  }
  async write (content) {
    this.count += content.length
    this.cache += content
    this.counter.cnt += content.length // 对写入内容长度计数
    // 8kb
    if (this.count >= (1 << 13)) {
      await this._write()
    }
  }
}

function Slicer (options) {
  if (!(this instanceof Slicer)) {
    return new Slicer(options);
  }

  Transform.call(this, options);
}

util.inherits(Slicer, Transform);

/**
 * This function will be called from the supper class.
 *
 * Call `push(newChunk)` to pass along transformed output
 * to the readable side.  You may call 'push' zero or more times.
 * Call `callback(err)` when you are done with this chunk.  If you pass
 * an error, then that'll put the hurt on the whole operation. If you
 * never call callback(), then you'll never get another chunk.
 *
 * @param {Buffer}   chunk    Is an input chunk.
 * @param {String}   encoding The encoding for this chunk.
 * @param {Function} callback The function, that will be called when this action is completed.
 *                            `function(err){}`
 * @private
 */
Slicer.prototype._transform = function (chunk, encoding, done) {
  this.push(chunk);
  done();
}

function getIdent(ident, level) {
  var res = '';
  for (var idx = 0; idx < (ident * level); idx++) {
    res += ' ';
  }
  return res;
}

function isValid (value) {
  if (value == null)
    return false
  if (typeof value == 'undefined')
    return false
  if (typeof value == 'function')
    return false
  return true
}

function getWriter (stream, counter) {
  return new Writer(stream, counter)
}

const DEFAULT_PARSED_LEVEL = 3
async function transformObject(obj, stream, options, level, parsedLevel) {
  const nl = options.ident > 0 ? '\n' : '';
  const space = options.ident > 0 ? ' ' : '';
  const identation = getIdent(options.ident, level);
  const identation2 = getIdent(options.ident, level + 1);

  if (parsedLevel >= DEFAULT_PARSED_LEVEL) {
    await stream.write(JSON.stringify(obj))
    return
  }

  await stream.write(`{`);
  const keys = Object.keys(obj);
  for (let i = 0; i < keys.length; i++) {
    if (!isValid(obj[keys[i]])) continue

    const k = keys[i]
    await stream.write(`${nl}${identation2}"${k}":${space}`);
    await transformValue(obj[k], stream, options, level + 1, parsedLevel+1);
    while (i + 1 < keys.length) {
      const value = obj[keys[i+1]]
      if (!isValid(value)) i++
      else
        break
    }
    if (i + 1 < keys.length) {
      await stream.write(',');
    }
  }
  await stream.write(`${nl}${identation}}`);
  if (parsedLevel == 1) {
    stream.emit('parsedEnd', null)
  }
}

async function transformValue(value, stream, options, level, parsedLevel) {
  const nl = options.ident > 0 ? '\n' : '';
  // const space = options.ident > 0 ? ' ' : '';
  const identation = getIdent(options.ident, level);
  const identation2 = getIdent(options.ident, level + 1);

  const type = Object.prototype.toString.call(value);
  switch (type) {
    case '[object Array]':
      await stream.write(`[`);

      let item = value.shift()
      while (item) {
        if (parsedLevel >= DEFAULT_PARSED_LEVEL) {
          await stream.write(JSON.stringify(item))
          if (value.length > 0)
            await stream.write(',')

          item = value.shift()
          continue
        }

        await stream.write(`${nl}${identation2}`);
        await transformValue(item, stream, options, level + 1, parsedLevel+1);
        if (value.length > 0) {
          await stream.write(',');
        }
        item = value.shift()
      }
      await stream.write(`${nl}${identation}]`);
      break;
    case '[object Object]':
      await transformObject(value, stream, options, level, parsedLevel+1);
      break;
    case '[object Number]':
    case '[object Boolean]':
    case '[object String]':
    case '[object Date]':
    case '[object Null]':
    case '[object Undefined]':
    default:
      await stream.write(`${JSON.stringify(value)}`);
  }
}

module.exports = (obj, options) => {
  if (typeof obj !== 'object') throw new Error('Please pass an object!');
  options = options || {};
  options.ident = options.ident || 0;

  const stream = new Slicer(options);
  process.nextTick(async () => {
    const counter = {cnt: 0}
    const writer = getWriter(stream, counter)
    await transformObject(obj, writer, options, 0, 1);
    stream.emit('count', counter.cnt)
    stream.end();
  });

  return stream;
};
