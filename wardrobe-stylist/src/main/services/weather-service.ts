// Weather service — uses OpenWeatherMap / 和风天气 API
// MVP: returns mock data

export async function getWeather(): Promise<{ temperature: number; condition: string; humidity: number }> {
  // TODO: Implement actual API call
  return {
    temperature: 22,
    condition: '晴',
    humidity: 55,
  };
}
