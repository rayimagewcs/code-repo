const fs = require('fs')
const stream = require('stream')
const obj = { name: 'wcs' }

const ws = fs.createWriteStream('./obj.json')

function stringChunk (str, size) {
  const chunks = new Array(Math.ceil(str.length / size))
  let pos = 0
  for (let i = 0; i < chunks.length; i++) {
    chunks[i] = str.substring(pos, pos + size)
    pos += size
  }
  return chunks
}

class ObjectReadableStream extends stream.Readable {
  constructor (obj) {
    super()
    this.__chunks = stringChunk(JSON.stringify(obj), 5)
  }
  _read () {
    const chunk = this.__chunks.shift()
    this.push(chunk)
  }
}

new ObjectReadableStream(obj).pipe(ws)
