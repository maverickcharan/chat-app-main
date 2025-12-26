import { createContext, useState, useEffect } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { io } from "socket.io-client";

const backendUrl = import.meta.env.VITE_BACKEND_URL;
axios.defaults.baseURL = `${backendUrl}/api`;

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem("token") || null);
  const [authUser, setAuthUser] = useState(
    JSON.parse(localStorage.getItem("user")) || null
  );
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (token) axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    else delete axios.defaults.headers.common["Authorization"];
  }, [token]);

  useEffect(() => {
    if (authUser) connectSocket(authUser);
  }, [authUser]);

  const checkAuth = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const { data } = await axios.get("/auth/check", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (data.success) {
        setAuthUser(data.user);
        localStorage.setItem("user", JSON.stringify(data.user));
      } else logout();
    } catch {
      logout();
    }
  };

  const login = async (state, credentials) => {
    try {
      const { data } = await axios.post(`/auth/${state}`, credentials);
      if (data.success) {
        setAuthUser(data.userData);
        setToken(data.token);

        localStorage.setItem("user", JSON.stringify(data.userData));
        localStorage.setItem("token", data.token);

        connectSocket(data.userData);
        toast.success(data.message);
      } else toast.error(data.message);
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setAuthUser(null);
    setOnlineUsers([]);

    if (socket) {
      socket.disconnect();
      setSocket(null);
    }
    toast.success("Logged out successfully");
  };

  const connectSocket = (userData) => {
    if (!userData || (socket && socket.connected)) return;

    const newSocket = io(backendUrl, { query: { userId: userData._id } });
    setSocket(newSocket);

    newSocket.on("onlineUsers", (userIds) => setOnlineUsers(userIds));
    newSocket.on("disconnect", () => setSocket(null));
  };

  return (
    <AuthContext.Provider
      value={{
        authUser,
        setAuthUser,
        token,
        onlineUsers,
        socket,
        login,
        logout,
        axios,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
