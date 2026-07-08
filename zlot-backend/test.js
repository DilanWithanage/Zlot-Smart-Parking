// test.js
async function testCheckIn() {
    const response = await fetch('http://localhost:3000/api/checkin', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            lotId: 'lot_id_001',
            plateNumber: 'CBA-1234'
        })
    });

    const data = await response.json();
    console.log("Server Response:", data);
}

testCheckIn();