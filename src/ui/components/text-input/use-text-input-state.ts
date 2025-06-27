import {useReducer, useCallback, useEffect, type Reducer, useMemo, useRef} from 'react';

type State = {
	previousValue: string;
	value: string;
	cursorOffset: number;
};

type Action =
	| MoveCursorLeftAction
	| MoveCursorRightAction
	| InsertAction
	| DeleteAction
	| SetValueAction;

type MoveCursorLeftAction = {
	type: 'move-cursor-left';
};

type MoveCursorRightAction = {
	type: 'move-cursor-right';
};

type InsertAction = {
	type: 'insert';
	text: string;
};

type DeleteAction = {
	type: 'delete';
};

type SetValueAction = {
	type: 'set-value';
	value: string;
};

const reducer: Reducer<State, Action> = (state, action) => {
	switch (action.type) {
		case 'move-cursor-left': {
			return {
				...state,
				cursorOffset: Math.max(0, state.cursorOffset - 1),
			};
		}

		case 'move-cursor-right': {
			return {
				...state,
				cursorOffset: Math.min(state.value.length, state.cursorOffset + 1),
			};
		}

		case 'insert': {
			return {
				...state,
				previousValue: state.value,
				value:
					state.value.slice(0, state.cursorOffset) +
					action.text +
					state.value.slice(state.cursorOffset),
				cursorOffset: state.cursorOffset + action.text.length,
			};
		}

		case 'delete': {
			const newCursorOffset = Math.max(0, state.cursorOffset - 1);

			return {
				...state,
				previousValue: state.value,
				value:
					state.value.slice(0, newCursorOffset) +
					state.value.slice(newCursorOffset + 1),
				cursorOffset: newCursorOffset,
			};
		}

		case 'set-value': {
			return {
				...state,
				previousValue: state.value,
				value: action.value,
				cursorOffset: action.value.length,
			};
		}
	}
};

export type UseTextInputStateProps = {
	/**
	 * Default input value.
	 */
	defaultValue?: string;

	/**
	 * Controlled input value.
	 */
	value?: string;

	/**
	 * Suggestions to autocomplete the input value.
	 */
	suggestions?: string[];

	/**
	 * Callback when input value changes.
	 */
	onChange?: (value: string) => void;

	/**
	 * Callback when enter is pressed. First argument is input value.
	 */
	onSubmit?: (value: string) => void;
};

export type TextInputState = State & {
	/**
	 * Suggested auto completion.
	 */
	suggestion: string | undefined;

	/**
	 * Move cursor to the left.
	 */
	moveCursorLeft: () => void;

	/**
	 * Move cursor to the right.
	 */
	moveCursorRight: () => void;

	/**
	 * Insert text.
	 */
	insert: (text: string) => void;

	/**
	 * Delete character.
	 */
	delete: () => void;

	/**
	 * Submit input value.
	 */
	submit: () => void;
};

export const useTextInputState = ({
	defaultValue = '',
	value,
	suggestions,
	onChange,
	onSubmit,
}: UseTextInputStateProps) => {
	const [state, dispatch] = useReducer(reducer, {
		previousValue: defaultValue,
		value: value || defaultValue,
		cursorOffset: defaultValue.length,
	});

	// 使用ref跟踪上一次的外部value，避免重复更新
	const lastExternalValueRef = useRef<string | undefined>(value);

	const suggestion = useMemo(() => {
		if (state.value.length === 0) {
			return;
		}

		return suggestions
			?.find(suggestion => suggestion.startsWith(state.value))
			?.replace(state.value, '');
	}, [state.value, suggestions]);

	const moveCursorLeft = useCallback(() => {
		dispatch({
			type: 'move-cursor-left',
		});
	}, []);

	const moveCursorRight = useCallback(() => {
		dispatch({
			type: 'move-cursor-right',
		});
	}, []);

	const insert = useCallback((text: string) => {
		dispatch({
			type: 'insert',
			text,
		});
	}, []);

	const deleteCharacter = useCallback(() => {
		dispatch({
			type: 'delete',
		});
	}, []);

	const submit = useCallback(() => {
		// 只发送当前输入值，不自动补全
		onSubmit?.(state.value);
	}, [state.value, onSubmit]);

	// 修复：只在内部状态变化且与外部value不同时调用onChange
	useEffect(() => {
		if (state.value !== state.previousValue && state.value !== value) {
			onChange?.(state.value);
		}
	}, [state.previousValue, state.value, onChange, value]);

	// 修复：只在外部value明确变化且与内部状态不同时更新
	useEffect(() => {
		if (value !== undefined && value !== lastExternalValueRef.current && value !== state.value) {
			lastExternalValueRef.current = value;
			dispatch({
				type: 'set-value',
				value,
			});
		}
	}, [value, state.value]);

	return {
		...state,
		suggestion,
		moveCursorLeft,
		moveCursorRight,
		insert,
		delete: deleteCharacter,
		submit,
	};
};