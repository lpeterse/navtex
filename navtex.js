
class Noise {
    trigger() {
        return Math.random() * 2 - 1;
    }
}

let sqrt = (s, c) => {
    return Math.sqrt(s * s + c * c);
}

class Wave {
    constructor(buffer) {
        this.index = 0;
        this.buffer = buffer;

        this.rate = 44100;
        this.w = 100;

        this.f = 955;
        this.f_lo = this.f - 85;
        this.f_hi = this.f + 85;

        this.dphi_lo = this.f_lo / this.rate;
        this.dphi_hi = this.f_hi / this.rate;

        this.state = true;
        this.state_sum = 0;
        this.state_count = 0;
    }

    sum() {
        return this.state_sum;
    }

    trigger() {
        this.index += 1;

        let acc_lo_sin = 0;
        let acc_lo_cos = 0;
        let acc_hi_sin = 0;
        let acc_hi_cos = 0;

        for (var i = 0; i < this.w; i++) {
            let j = this.index * this.w + i;
            let s = this.buffer.getChannelData(0)[j];
            acc_lo_sin += s * Math.sin(2 * Math.PI * j * this.dphi_lo);
            acc_lo_cos += s * Math.cos(2 * Math.PI * j * this.dphi_lo);
            acc_hi_sin += s * Math.sin(2 * Math.PI * j * this.dphi_hi);
            acc_hi_cos += s * Math.cos(2 * Math.PI * j * this.dphi_hi);
        }

        let lo = sqrt(acc_lo_sin, acc_lo_cos);
        let hi = sqrt(acc_hi_sin, acc_hi_cos);
        this.state = lo > hi;
        this.state_sum = hi - lo;
        return this.state;
    }
}

class PLL {
    constructor() {
        this.blocklen = 4.0;
        this.count = 0;
        this.hi = false;
    }

    state() {
        return this.expected;
    }

    error() {
        return this.actual != this.expected;
    }

    // x is the difference between lo and hi!
    trigger(x) {
        let hix = x > 0;
        if (hix == this.hi) {
            this.count++;
            return [];
        } else {
            let x = this.count / this.blocklen;
            let y = Math.round(x);
            let z = Math.abs(x - y);

            if (z > 0.5) {
                console.log("IGNORE ERROR!", this.count, this.blocklen, x, y, z);
                this.count++;
                return [];
            }

            let blocklen = this.count / y;
            if (Math.abs(this.blocklen - blocklen) < this.blocklen / 4) {
                let blocklen_old = this.blocklen;
                let blocklen_new = 0.9 * blocklen_old + 0.1 * blocklen;
                //console.log(`Adapt blocklen: OLD ${blocklen_old} NEW ${blocklen_new} SEEN ${blocklen}`);
                this.blocklen = blocklen_new;
            }
            let bits = [];
            for (var i = 0; i < y; i++) {
                bits.push(!!this.hi);
            }
            // Reset
            this.count = 1;
            this.hi = hix;
            return bits;
        }
    }
}

class Decoder {
    constructor() {
        this.bits = [];
        this.channel = false;
        this.alpha = "";
        this.alpha_figs = false;
        this.beta = "";
        this.beta_figs = false;
    }

    push(bits) {
        this.bits = this.bits.concat(bits);
        let s = "";
        if (this.bits.length < 7) {
            return;
        }
        let ones = 0
            + this.bits[0]
            + this.bits[1]
            + this.bits[2]
            + this.bits[3]
            + this.bits[4]
            + this.bits[5]
            + this.bits[6];
        if (ones != 4) {
            console.log("SHIFT");
            this.bits = this.bits.slice(1);
            return;
        }
        let byte = 0
            | this.bits[0] << 0
            | this.bits[1] << 1
            | this.bits[2] << 2
            | this.bits[3] << 3
            | this.bits[4] << 4
            | this.bits[5] << 5
            | this.bits[6] << 6;
        this.bits = this.bits.slice(7);
        this.push_byte(byte);
        let t = document.getElementById("text1")
        t.value = this.alpha;
        t.scrollTop = t.scrollHeight;
        //document.getElementById("text2").innerText = this.beta;
    }

    push_byte(byte) {
        this.channel = !this.channel;
        if (this.channel) {
            this.push_byte_alpha(byte);
        } else {
            this.push_byte_beta(byte);
        }
    }

    push_byte_alpha(byte) {
        if (byte == 0x36) {
            this.alpha_figs = true;
        }
        if (byte == 0x5a) {
            this.alpha_figs = false;
        }
        this.alpha += this.alpha_figs ? this.decode_figure(byte) : this.decode_letter(byte);
    }

    push_byte_beta(byte) {
        if (byte == 0x36) {
            this.beta_figs = true;
        }
        if (byte == 0x5a) {
            this.beta_figs = false;
        }
        this.beta += this.beta_figs ? this.decode_figure(byte) : this.decode_letter(byte);
    }

    decode_letter(byte) {
        switch (byte) {
            case 0x0f: return ''; //'[alpha]';
            case 0x17: return 'J';
            case 0x1b: return 'F';
            case 0x1d: return 'C';
            case 0x1e: return 'K';
            case 0x27: return 'W';
            case 0x2b: return 'Y';
            case 0x2d: return 'P';
            case 0x2e: return 'Q';
            case 0x33: return ''; //'[beta]';
            case 0x35: return 'G';
            case 0x36: return ''; //'[figs]';
            case 0x39: return 'M';
            case 0x3a: return 'X';
            case 0x3c: return 'V';
            case 0x47: return 'A';
            case 0x4b: return 'S';
            case 0x4d: return 'I';
            case 0x4e: return 'U';
            case 0x53: return 'D';
            case 0x55: return 'R';
            case 0x56: return 'E';
            case 0x59: return 'N';
            case 0x5a: return ''; //'[ltrs]';
            case 0x5c: return ' ';
            case 0x63: return 'Z';
            case 0x65: return 'L';
            case 0x69: return 'H';
            case 0x6c: return '\n';
            case 0x71: return 'O';
            case 0x72: return 'B';
            case 0x74: return 'T';
            case 0x78: return '\r';
            default: return '';
        }
    }

    decode_figure(byte) {
        let table = {
            0x0f: '', // '[alpha]',
            0x17: "'",
            0x1b: '!',
            0x1d: ':',
            0x1e: '(',
            0x27: '2',
            0x2b: '6',
            0x2d: '0',
            0x2e: '1',
            0x33: '', //'[beta]',
            0x35: '&',
            0x36: '', //'[figs]',
            0x39: '.',
            0x3a: '/',
            0x3c: ';',
            0x47: '-',
            0x4b: '\b',
            0x4d: '8',
            0x4e: '7',
            0x53: '$',
            0x55: '4',
            0x56: '3',
            0x59: ',',
            0x5a: '', // '[ltrs]',
            0x5c: ' ',
            0x63: '"',
            0x65: ')',
            0x69: '#',
            0x6c: '\n',
            0x71: '9',
            0x72: '?',
            0x74: '5',
            0x78: '\r'
        };
        return table[byte] || "";
    }
}

function play() {
    let source = audioCtx.createBufferSource();
    source.buffer = audio;
    source.connect(audioCtx.destination);
    source.start(0);
}

function init() {
    let height = window.innerHeight - 200;
    let width = window.innerWidth;
    //<input  id="noise" type="range" min="0" max="100" value="50">
    //<button id="play">PLAY</button>
    //<textarea id="text2" style="width: 1000px"></textarea>
    document.body.innerHTML = `
        <textarea id="text1" style="width: ${width}px; height: 100px;"></textarea><br>
        <canvas id="canvas" height="${height}" width="${width}"></canvas>
    `;
    var canvas = document.getElementById("canvas").getContext("2d");

    let running = true;

    let q = 4;
    let x = 0;
    let y = 50;

    let wav = new Wave(window.audio);
    let nse = new Noise();
    let pll = new PLL();
    let dec = new Decoder();

    let marker_state = 1;
    let noise_level = 1;

    let tick = () => {
        if (!running) {
            return;
        }

        canvas.fillStyle = "rgba(255,255,255,0.1)";
        canvas.fillRect(x, 0, 200, 1000);

        if (marker_state ^= 1) {
            canvas.fillStyle = "rgb(200,200,0)";
            canvas.fillRect(x, y, q - 1, 5);
        } else {
            canvas.fillStyle = "rgb(200,200,0)";
            canvas.fillRect(x, y + 4, q - 1, 5);
        }

        wav.trigger();
        if (wav.sum() > 0) {
            canvas.fillStyle = "rgb(0,0,255)";
        } else {
            canvas.fillStyle = "rgb(255,0,0)";
        }
        canvas.fillRect(x, y + 50, q - 1, Math.min(25, -wav.sum() * 10));

        let bits = pll.trigger(wav.sum());
        for (var i = 0; i < bits.length; i++) {
            let bit = bits[i];
            if (bit) {
                canvas.fillStyle = "rgb(0,0,255)";
            } else {
                canvas.fillStyle = "rgb(255,0,0)";
            }
            canvas.fillRect(x - 2 * q, y + 100 + i * pll.blocklen * q, 2 * q, 2 * q);
        }

        dec.push(bits);

        //canvas.fillStyle = "rgb(0,255,255)";
        //canvas.fillRect(x, y+150, q - 1, -pll.blocklen*5);

        // if (pll.state()) {
        //     canvas.fillStyle = "rgb(0,0,255)";
        //     canvas.fillRect(x, y+70, q - 1, 50);
        // } else {
        //     canvas.fillStyle = "rgb(200,200,200)";
        //     canvas.fillRect(x, y+70, q - 1, 50);
        // }

        // if (pll.error()) {
        //     canvas.fillStyle = "rgb(255,0,00)";
        //     canvas.fillRect(x, y+126, q - 1, 20);
        // } else {
        //     canvas.fillStyle = "rgb(0,255,0)";
        //     canvas.fillRect(x, y+126, q - 1, 20);
        // }

        x += q;
        if (x > width) {
            x = 0;
        }
    };

    // document.getElementById("noise").oninput = () => {
    //     noise_level = noise.value / 100;
    // };
    // document.getElementById("play").onclick = () => {
    //     play();
    // };
    document.getElementById("canvas").onclick = () => {
        running = !running;
    }
    window.setInterval(tick, 4);
}

window.onload = function () {
    window.audioCtx = new AudioContext();
    //window.fetch("/phasing.wav")
    // window.fetch("/SITOR-B.wav")
    window.fetch("/navtex.wav")
        .then(x => x.arrayBuffer())
        .then(x => window.audioCtx.decodeAudioData(x))
        .then(x => window.audio = x)
        .then(() => init());
}
