import axios from "axios";

export const calculateSalary = async (payload: any) => {
  const response = await axios.post(
  `${import.meta.env.VITE_API_BASE_URL}/salary/calculate`,
  payload
);

  return response.data;
};
