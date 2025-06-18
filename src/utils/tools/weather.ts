import { Tool } from '@langchain/core/tools';

/**
 * 天气查询工具
 * 模拟天气查询功能，返回指定城市的天气信息
 */
export class WeatherTool extends Tool {
  name = 'weather_query';
  description = '查询指定城市的天气信息。输入格式：城市名称，例如：杭州、北京、上海等';

  protected async _call(input: string): Promise<string> {
    try {
      const city = input.trim();
      
      if (!city) {
        return '请提供城市名称，例如：杭州、北京、上海等';
      }

      // 模拟天气数据
      const weatherData = this.getMockWeatherData(city);
      
      if (weatherData) {
        return `📍 ${city}天气信息：
🌤️  天气状况：${weatherData.condition}
🌡️  温度：${weatherData.temperature}°C
💨  风力：${weatherData.wind}
💧  湿度：${weatherData.humidity}%
👁️  能见度：${weatherData.visibility}km
📅  更新时间：${weatherData.updateTime}`;
      } else {
        return `抱歉，暂时无法获取${city}的天气信息，请稍后再试。`;
      }
    } catch (error) {
      return `查询天气时发生错误：${error instanceof Error ? error.message : '未知错误'}`;
    }
  }

  /**
   * 获取模拟天气数据
   * 在实际应用中，这里应该调用真实的天气API
   */
  private getMockWeatherData(city: string) {
    const weatherConditions = [
      '晴天',
      '多云',
      '阴天',
      '小雨',
      '中雨',
      '大雨',
      '雪',
      '雾霾'
    ];

    const windLevels = [
      '微风',
      '3-4级',
      '4-5级',
      '5-6级',
      '6-7级'
    ];

    // 根据城市名称生成一致的天气数据（使用城市名称的哈希值）
    const cityHash = this.hashCode(city);
    const seed = cityHash % 1000;

    // 根据种子生成天气数据
    const condition = weatherConditions[seed % weatherConditions.length];
    const temperature = 15 + (seed % 20); // 15-35度
    const wind = windLevels[seed % windLevels.length];
    const humidity = 40 + (seed % 40); // 40-80%
    const visibility = 5 + (seed % 15); // 5-20km

    return {
      condition,
      temperature,
      wind,
      humidity,
      visibility,
      updateTime: new Date().toLocaleString('zh-CN')
    };
  }

  /**
   * 简单的字符串哈希函数
   */
  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash);
  }
}

/**
 * 创建天气查询工具实例
 */
export function createWeatherTool(): WeatherTool {
  return new WeatherTool();
}

/**
 * 天气查询工具的使用示例
 */
export async function weatherToolExample() {
  const weatherTool = createWeatherTool();
  
  console.log('=== 天气查询工具示例 ===\n');
  
  const cities = ['杭州', '北京', '上海', '深圳', '成都'];
  
  for (const city of cities) {
    console.log(`查询${city}天气:`);
    const result = await weatherTool.call(city);
    console.log(result);
    console.log('---');
  }
}

// 如果直接运行此文件，则执行示例
if (import.meta.url === `file://${process.argv[1]}`) {
  weatherToolExample();
} 