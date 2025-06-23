import ChatHistory from "./chatHistory.js";

export default function ChatHistoryList(props: any) {
  const { chatList } = props;
  //历史聊天界面

  const outputList = chatList.map(
    (item: { input: string; output: string }, index: any) => {
      return (
        <ChatHistory key={index} input={item.input} output={item.output} />
      );
    }
  );

  return <>{outputList}</>;
}
