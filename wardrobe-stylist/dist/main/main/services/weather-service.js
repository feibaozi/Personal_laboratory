"use strict";
// Weather service — uses OpenWeatherMap / 和风天气 API
// MVP: returns mock data
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWeather = getWeather;
async function getWeather() {
    // TODO: Implement actual API call
    return {
        temperature: 22,
        condition: '晴',
        humidity: 55,
    };
}
//# sourceMappingURL=weather-service.js.map