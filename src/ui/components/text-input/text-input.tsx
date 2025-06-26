import React, {useMemo} from 'react';
import {Text} from 'ink';
import {useComponentTheme} from '../theme.js';
import {type Theme} from './theme.js';
import {useInput} from 'ink';
import chalk from 'chalk';

export type TextInputProps = {
	/**
	 * When disabled, user input is ignored.
	 *
	 * @default false
	 */
	readonly isDisabled?: boolean;

	/**
	 * Text to display when input is empty.
	 */
	readonly placeholder?: string;

	/**
	 * Default input value.
	 */
	readonly defaultValue?: string;

	/**
	 * Controlled input value.
	 */
	readonly value?: string;

	/**
	 * Suggestions to autocomplete the input value.
	 */
	readonly suggestions?: string[];

	/**
	 * Callback when input value changes.
	 */
	readonly onChange?: (value: string) => void;

	/**
	 * Callback when enter is pressed. First argument is input value.
	 */
	readonly onSubmit?: (value: string) => void;

	/**
	 * Callback when tab is pressed.
	 */
	readonly onTab?: () => void;

	/**
	 * Current suggestion to autocomplete.
	 */
	readonly currentSuggestion?: string;

	/**
	 * Current cursor position in the input.
	 */
	readonly cursorOffset: number;

	/**
	 * Callback when cursor moves.
	 */
	readonly onCursorMove?: (offset: number) => void;

	/**
	 * Current suggestion to autocomplete.
	 */
	readonly suggestion?: string;
};

const cursor = chalk.inverse(' ');

export function TextInput({
	isDisabled = false,
	value = '',
	cursorOffset = 0,
	suggestion,
	placeholder = '',
	onChange,
	onCursorMove,
	onSubmit,
	onTab,
	currentSuggestion,
}: TextInputProps) {
	// 渲染输入内容和光标
	const renderedValue = useMemo(() => {
		if (isDisabled) return value;
		let index = 0;
		let result = value.length > 0 ? '' : cursor;
		for (const char of value) {
			result += index === cursorOffset ? chalk.inverse(char) : char;
			index++;
		}
		if (suggestion) {
			if (cursorOffset === value.length) {
				result += chalk.inverse(suggestion[0]) + chalk.dim(suggestion.slice(1));
			} else {
				result += chalk.dim(suggestion);
			}
			return result;
		}
		if (value.length > 0 && cursorOffset === value.length) {
			result += cursor;
		}
		return result;
	}, [isDisabled, value, cursorOffset, suggestion]);

	// 处理键盘输入
	useInput((input, key) => {
		if (isDisabled) return;
		if (key.tab || (key.shift && key.tab)) {
			if (currentSuggestion) {
				onChange?.(value + currentSuggestion);
			}
			onTab?.();
			return;
		}
		if (key.return) {
			onSubmit?.(value);
			return;
		}
		if (key.leftArrow) {
			if (onCursorMove && cursorOffset > 0) onCursorMove(cursorOffset - 1);
			return;
		}
		if (key.rightArrow) {
			if (onCursorMove && cursorOffset < value.length) onCursorMove(cursorOffset + 1);
			return;
		}
		if (key.backspace || key.delete) {
			if (cursorOffset > 0) {
				const newValue = value.slice(0, cursorOffset - 1) + value.slice(cursorOffset);
				onChange?.(newValue);
				if (onCursorMove) onCursorMove(cursorOffset - 1);
			}
			return;
		}
		// 普通字符输入
		if (input && !key.ctrl && !key.meta) {
			const newValue = value.slice(0, cursorOffset) + input + value.slice(cursorOffset);
			onChange?.(newValue);
			if (onCursorMove) onCursorMove(cursorOffset + input.length);
			return;
		}
	}, {isActive: !isDisabled});

	const {styles} = useComponentTheme<Theme>('TextInput');
	return <Text {...styles.value()}>{renderedValue || chalk.dim(placeholder)}</Text>;
}