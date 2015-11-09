var Transform = require('readable-stream/transform');

module.exports = function () {
    var tr = Transform();
    var index = 0;
    var buffer = null;
    
    tr._transform = function (chunk, enc, next) {
        var len = chunk.length;
        if (len === 0) return next();
        var i = 0;
        
        if (buffer) {
            var blen = buffer.length;
            for (; i < len; i++) {
                buffer[index++] = chunk[i];
                if (index === blen) {
                    this.push(buffer);
                    buffer = null;
                    i++;
                    break;
                }
            }
            if (buffer) return next();
        }
        
        for (var j = Math.max(i, len - 5); j < len; j++) {
            var n = nbytes(chunk[j]);
            if (n > len - j) {
                if (j - i > 0) this.push(chunk.slice(i, j));
                buffer = Buffer(n);
                for (index = 0; index < len - j; index++) {
                    buffer[index] = chunk[j + index];
                }
                break;
            }
        }
        
        if (!buffer && i < len) {
            this.push(i ? chunk.slice(i) : chunk);
        }
        next();
    };
    
    tr._flush = function () {
        if (buffer) this.push(buffer.slice(0, index));
        this.push(null);
    };
    
    return tr;
};

function nbytes (b) {
    if (b >= 252) return 6;
    else if (b >= 248) return 5;
    else if (b >= 240) return 4;
    else if (b >= 224) return 3;
    else if (b >= 192) return 2;
    else return 1;
}
