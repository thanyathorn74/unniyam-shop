document.addEventListener('DOMContentLoaded', () => {
    loadUsers();
    loadNotifications();
    checkUrlParams();
});

// 1. Security Check
const user = JSON.parse(localStorage.getItem("user"));
if (!user || user.role !== "admin") {
    alert("⛔ Access Denied: Admins Only");
    window.location.href = "/index.html";
}

// 2. Load Users Table
function loadUsers() {
    fetch('/admin/users')
        .then(res => res.json())
        .then(users => {
            const tbody = document.querySelector('#userTable tbody');
            tbody.innerHTML = '';
            
            users.forEach(u => {
                // Style badge based on status
                const statusBadge = u.status === 'active' 
                    ? `<span class="status-active">Active</span>` 
                    : `<span class="status-suspended">Suspended</span>`;

                // Highlight Admin roles
                const roleDisplay = u.role === 'admin' 
                    ? `<b style="color:#d90429;">ADMIN</b>` 
                    : u.role;

                tbody.innerHTML += `
                    <tr id="row-${u.user_id}">
                        <td>#${u.user_id}</td>
                        <td>
                            <div style="display:flex; align-items:center; gap:10px;">
                                <img src="/uploads/${u.profile_pic_url || 'default.png'}" 
                                     style="width:35px; height:35px; border-radius:50%; object-fit:cover; border:1px solid #ddd;">
                                <div>
                                    <div style="font-weight:bold;">${u.display_name}</div>
                                    <div style="font-size:0.8rem; color:#666;">${u.email}</div>
                                </div>
                            </div>
                        </td>
                        <td>${roleDisplay}</td>
                        <td>${statusBadge}</td>
                        <td>
                            <button class="btn-edit" onclick="openEditModal(${u.user_id}, '${u.display_name}', '${u.role}', '${u.status}')">
                                <i class="fas fa-edit"></i> Manage
                            </button>
                            <button class="btn-delete" onclick="deleteUser(${u.user_id})">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `;
            });
        })
        .catch(err => console.error("Error loading users:", err));
}

// 3. Edit Modal Functions (The "Interaction" Part)
function openEditModal(id, name, role, status) {
    document.getElementById('editUserId').value = id;
    document.getElementById('editUsername').value = name;
    document.getElementById('editRole').value = role;
    document.getElementById('editStatus').value = status || 'active';
    document.getElementById('editModal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('editModal').style.display = 'none';
}

// 4. Save Changes (Promote/Demote/Ban)
document.getElementById('editUserForm').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const id = document.getElementById('editUserId').value;
    const role = document.getElementById('editRole').value;
    const status = document.getElementById('editStatus').value;

    fetch(`/admin/user/update/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, status })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            alert(`✅ User updated successfully!\nRole: ${role}\nStatus: ${status}`);
            closeModal();
            loadUsers(); // Refresh table to show changes
        } else {
            alert("Error updating user");
        }
    })
    .catch(err => console.error(err));
});

// 5. Delete User
function deleteUser(id) {
    if(confirm("⚠️ Are you sure you want to delete this user? This cannot be undone.")) {
        fetch(`/admin/user/${id}`, { method: 'DELETE' })
            .then(res => res.json())
            .then(data => {
                if(data.success) {
                    loadUsers();
                } else {
                    alert("Error deleting user");
                }
            });
    }
}

// 6. Notifications Logic
function loadNotifications() {
    fetch('/api/notifications')
        .then(res => res.json())
        .then(data => {
            const container = document.getElementById('noti-list');
            const badge = document.getElementById('noti-count');
            container.innerHTML = '';

            const alerts = data.filter(n => n.type === 'admin_alert');

            if (alerts.length === 0) {
                container.innerHTML = '<p style="color:#999; font-size:0.9rem;">No new alerts.</p>';
                badge.style.display = 'none';
                return;
            }

            badge.innerText = alerts.length;
            badge.style.display = 'inline-block';

            alerts.forEach(n => {
                container.innerHTML += `
                    <div class="noti-item">
                        <div style="margin-bottom:5px;">${n.message}</div>
                        <div class="noti-actions">
                            ${n.action_link ? `<button class="btn-edit" style="padding:2px 8px; font-size:0.8rem;" onclick="window.location.href='${n.action_link}'">View</button>` : ''}
                            <button class="btn-delete" style="padding:2px 8px; font-size:0.8rem;" onclick="dismissNoti(${n.notification_id})">Dismiss</button>
                        </div>
                    </div>
                `;
            });
        });
}

function dismissNoti(id) {
    fetch(`/admin/notification/${id}`, { method: 'DELETE' })
        .then(() => loadNotifications());
}

function checkUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const highlightId = urlParams.get('highlightUser');
    if (highlightId) {
        setTimeout(() => {
            const row = document.getElementById(`row-${highlightId}`);
            if (row) {
                row.style.backgroundColor = "#fff3cd";
                row.scrollIntoView({ behavior: "smooth" });
            }
        }, 500);
    }
}

function adminLogout() {
    fetch('/logout').then(() => {
        localStorage.removeItem('user');
        window.location.href = "/index.html";
    });
}