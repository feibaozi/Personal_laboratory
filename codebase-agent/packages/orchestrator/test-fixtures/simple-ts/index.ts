import { add, subtract } from './helper';

function calculate(x: number, y: number): number {
    if (x > 0) {
        return add(x, y);
    }
    return subtract(x, y);
}

class Calculator {
    private total: number = 0;

    add(value: number): void {
        this.total += value;
    }

    getTotal(): number {
        return this.total;
    }
}