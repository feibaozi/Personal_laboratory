from utils import add, subtract

def calculate(x: int, y: int) -> int:
    if x > 0:
        return add(x, y)
    else:
        return subtract(x, y)


class Calculator:
    def __init__(self):
        self.total = 0

    def add(self, value: int) -> None:
        self.total += value

    def get_total(self) -> int:
        return self.total