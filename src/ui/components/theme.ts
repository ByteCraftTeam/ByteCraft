import {type ComponentTheme} from './text-input/theme.js';

// 组件主题注册表
const componentThemes = new Map<string, ComponentTheme>();

// 注册组件主题
export function registerComponentTheme(componentName: string, theme: ComponentTheme) {
	componentThemes.set(componentName, theme);
}

// 使用组件主题
export function useComponentTheme<T extends ComponentTheme>(componentName: string): T {
	const theme = componentThemes.get(componentName) as T;
	if (!theme) {
		// 返回默认主题
		return {
			styles: {
				value: () => ({}),
			},
		} as unknown as T;
	}
	return theme;
}

// 注册TextInput主题
import textInputTheme from './text-input/theme.js';
registerComponentTheme('TextInput', textInputTheme); 