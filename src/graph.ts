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

        this.canvas = document.createElement('canvas');
        this.canvas.width = this.width * 4;
        this.canvas.height = this.height * 2;
        this.canvas.style.cssText = `width:100%;height:100%;`;
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
        ctx.fillStyle = 'darkblue';
        const w = width / this.data.length;
        const max = Math.max(...this.data);
        this.data.forEach((value, i) => {
            const h = (height * value) / max;
            ctx.fillRect(i * w, height - h, w, h);
        });
        if (this.data.length) {
            ctx.fillStyle = 'white';
            ctx.fillText(this.data[this.data.length - 1].toPrecision(2) + ' fps', 2, 20);
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
