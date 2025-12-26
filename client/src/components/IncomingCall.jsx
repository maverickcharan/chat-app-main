export default function IncomingCall({ call, onAccept, onReject }) {
  return (
    <div className="fixed inset-0 bg-black/80 flex flex-col items-center justify-center z-50">
      <h2 className="text-white text-xl">Incoming {call.callType} call</h2>
      <div className="flex gap-4 mt-4">
        <button onClick={onAccept} className="bg-green-500 px-5 py-2 rounded">Accept</button>
        <button onClick={onReject} className="bg-red-500 px-5 py-2 rounded">Reject</button>
      </div>
    </div>
  );
}
