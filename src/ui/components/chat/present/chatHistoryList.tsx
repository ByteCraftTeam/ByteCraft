import ChatHistroy from "./chatHistroy";

export default function ChatHistroyList(props: any) {
  const { chatList } = props;
  //历史聊天界面

  const outputList = chatList.map(
    (item: { input: string; output: string }, index: any) => {
      return (
        <ChatHistroy key={index} input={item.input} output={item.output} />
      );
    }
  );

  return <>{outputList}</>;
}
