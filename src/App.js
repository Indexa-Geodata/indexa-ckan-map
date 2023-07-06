import { BrowserRouter, Routes, Route } from "react-router-dom";
import Map from './Map';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/maps" element={<Map />}>
          <Route index element={<Map />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}