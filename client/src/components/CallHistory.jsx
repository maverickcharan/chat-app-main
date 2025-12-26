import React, { useContext, useEffect } from "react";
import ChatContainer from "../components/ChatContainer";



const CallHistory = () => {
  const { callHistory, getCallHistory, selectedUser } = useContext(ChatContext);

  useEffect(() => {
    if (selectedUser) getCallHistory(selectedUser._id);
  }, [selectedUser]);

  return (
    <div>
      <h2>Call History</h2>
      {callHistory.length === 0 ? (
        <p>No calls yet</p>
      ) : (
        <ul>
          {callHistory.map((call, idx) => (
            <li key={idx}>
              {call.type} call with {call.userName} at {new Date(call.time).toLocaleString()}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default CallHistory;
