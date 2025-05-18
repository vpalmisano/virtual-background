export class Graph {
    data: number[];
    width: number;
    height: number;
    maxPoints: number;
    div: HTMLDivElement | null;
    canvas: HTMLCanvasElement | null;
    ctx: CanvasRenderingContext2D | null;

    constructor() {
        this.data = Array.from({ length: 50 }, () => 0);
        this.width = 50;
        this.height = 50;
        this.maxPoints = this.width;

        document.querySelectorAll('div.video-performance-canvas').forEach((e) => e.remove());

        this.div = document.createElement('div');
        this.div.classList.add('video-performance-canvas');
        this.div.style.cssText = `position:fixed;top:0;right:0;width:${this.width * 2}px;height:${this.height}px;z-index:99999;background-color:black;`;
        document.body.appendChild(this.div);

        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'X';
        closeBtn.style.cssText = `margin:0;padding:2px;color:white;background-color:transparent;width:10px;height:10px;position:absolute;top:0px;right:1px;font-family:Sans;font-size:10px;line-height:10px;border:0px;`;
        closeBtn.addEventListener('click', () => {
            this.remove();
        });
        this.div.appendChild(closeBtn);

        this.canvas = document.createElement('canvas');
        this.canvas.width = this.width * 4;
        this.canvas.height = this.height * 2;
        this.canvas.style.cssText = `width:100%;height:100%;margin-top:10px;`;
        this.div.appendChild(this.canvas);

        this.ctx = this.canvas.getContext('2d');
        if (this.ctx) this.ctx.font = '20px Sans';
        this.draw();
    }

    remove() {
        this.data = [];
        this.div?.remove();
        this.div = null;
        this.canvas = null;
        this.ctx = null;
    }

    draw() {
        if (!this.ctx || !this.canvas) return;
        const ctx = this.ctx;
        const { width, height } = this.canvas;
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = 'red';
        const w = width / this.data.length;
        const max = Math.max(...this.data);
        this.data.forEach((value, i) => {
            const h = (height * value) / max;
            ctx.fillRect(i * w, height - h, w - 1, h);
        });
        if (this.data.length) {
            ctx.fillStyle = 'white';
            ctx.fillText(this.data[this.data.length - 1].toPrecision(2), 2, 20);
        }
    }

    push(value: number, info: string) {
        if (!this.div) return;
        this.data.push(value);
        if (this.data.length > this.maxPoints) {
            this.data.splice(0, this.data.length - this.maxPoints);
        }
        this.draw();
        this.div.title = info;
    }
}
