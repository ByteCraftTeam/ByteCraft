import {type TextProps} from 'ink';
export type ComponentTheme = {
	styles?: Record<string, (props?: any) => ComponentStyles>;
	config?: (props?: any) => Record<string, unknown>;
};
export type ComponentStyles = TextProps;


const theme = {
	styles: {
		value: (): ComponentStyles => ({}),
	},
} satisfies ComponentTheme;

export default theme;
export type Theme = typeof theme;