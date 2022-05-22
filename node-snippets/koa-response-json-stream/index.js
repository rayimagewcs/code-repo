const fs = require('fs')
const Stream = require('stream')
const path = require('path')
const { format, promisify } = require('util')

const uuid = require('uuid')
const jsonTransform = require('./jsonTransform')

const logger = console
const perfLogger = console
const pipelineAsync = promisify(Stream.pipeline)

/**
 * 
 * 经测试结果： 通过文件缓存再以文件流方式发送可以避免请求占用过多资源，服务端可以更好的响应其它接口请求。
 * @param {*} maxSendBufSize 
 * @returns 
 */
module.exports = function () {
  return async (ctx, next) => {

    const startTime = Date.now()
    await next()

    let responseBody = ctx.body
    if (responseBody == null) return
    if (Buffer.isBuffer(responseBody)) return
    if (responseBody instanceof Stream) return // 文件下载等

    if ('string' === typeof responseBody) return // 返回普通的 string、静态html等

    // json
    ctx.set('Content-Type', 'application/json')
    ctx.res.on('finish', () => {
      logger.info(format('"%s %s %s" %d length - %d ms',
        ctx.request.method,
        ctx.request.path,
        ctx.querystring,
        ctx.countLength,
        Date.now() - startTime))
    })
    // await sendJson(ctx, responseBody) // send json directly
    await sendJsonWithFile(ctx, responseBody)
  }
}

async function sendJsonWithFile (ctx, responseBody) {
  const start = Date.now()
  let cachePath = ''
  try {
    cachePath = await streamStringify(ctx, responseBody)
    responseBody = null // help gc
    perfLogger.debug(format('stringify %d length of json, used %d ms.', ctx.countLength, Date.now() - start))
  
    const begin = Date.now()
    const rs = fs.createReadStream(cachePath)
    await pipelineAsync(
      rs,
      ctx.res
    )
    ctx.respond = false
    perfLogger.debug(format('http response %d length of json, used %d ms.', ctx.countLength, Date.now() - begin))
  } catch (err) {
    logger.error(format('http response "%s %s %s" error.',
      ctx.request.method,
      ctx.request.path,
      ctx.querystring,
      err,
    ))
  } finally {
    if (cachePath)
      fs.unlink(cachePath, err => {
        if (err) console.log('unlink file <%s> error <%s>.', cachePath, err)
      })
  }
}

function sendJson (ctx, responseBody) {
  const stream = jsonTransform(responseBody, {indent: 0})
  stream.on('count', length => {
    ctx.countLength = length
  })
  ctx.body = stream
}

function streamStringify (ctx, responseBody) {
  return new Promise(async (resolve) => {
    const tmpPath = path.resolve('/tmp/cache-' + uuid.v4())
    const ws = fs.createWriteStream(tmpPath, {
      emitClose: true
    })
    const stream = jsonTransform(responseBody, {indent: 0})
    stream.on('count', length => {
        ctx.countLength = length
    })
    try {
      await pipelineAsync(
        stream,
        ws
      )
    } catch (err) {
      logger.warn('stringify cache to local file error.', err)
    }
    resolve(tmpPath)
  })
}
