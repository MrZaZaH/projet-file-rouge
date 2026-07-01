// moderation-panel.js
// Admin moderation panel — stats, pending recipes, logs, CSV export.

// ====== STATE ======
var pendingRecipes = [];

// ====== FETCH HELPERS ======

async function fetchDashboard() {
    return apiRequest('/admin/dashboard');
}

async function fetchPendingRecipes() {
    return apiRequest('/admin/recipes?sort_by=created_at&limit=50');
}

async function fetchLogs() {
    return apiRequest('/admin/logs?limit=50');
}

// ====== RENDER STATS ======

function renderStats(data) {
    var r = data.recipes;
    document.getElementById('stat-total').textContent = r.total;
    document.getElementById('stat-pending').textContent = r.by_status.pending;
    document.getElementById('stat-published').textContent = r.by_status.published;
    document.getElementById('stat-users').textContent = data.users.total;
    document.getElementById('stat-avg-rating').textContent = '—';
}

// ====== RENDER TOP RECIPES ======

function renderTopViewed(recipes) {
    var container = document.getElementById('top-viewed');
    container.innerHTML = '';
    if (!recipes || recipes.length === 0) {
        container.innerHTML = '<p class="text-muted">Aucune donnée</p>';
        return;
    }
    var list = document.createElement('ul');
    list.style.cssText = 'list-style:none;padding:0;';
    recipes.forEach(function(r) {
        var li = document.createElement('li');
        li.style.cssText = 'background:var(--surface);border:var(--border-thin);padding:0.75rem;margin-bottom:0.5rem;';
        li.innerHTML =
            '<a href="recipe.html?id=' + r.id + '" style="font-weight:700;font-style:italic;">' + escapeHtml(r.title) + '</a>' +
            '<br><span class="text-muted" style="font-size:0.8rem;">par ' + escapeHtml(r.author || '—') +
            ' &middot; ' + (r.views || 0) + ' vues</span>';
        list.appendChild(li);
    });
    container.appendChild(list);
}

function renderTopRated(recipes) {
    var container = document.getElementById('top-rated');
    container.innerHTML = '';
    if (!recipes || recipes.length === 0) {
        container.innerHTML = '<p class="text-muted">Aucune donnée (minimum 3 notes)</p>';
        return;
    }
    var list = document.createElement('ul');
    list.style.cssText = 'list-style:none;padding:0;';
    recipes.forEach(function(r) {
        var li = document.createElement('li');
        li.style.cssText = 'background:var(--surface);border:var(--border-thin);padding:0.75rem;margin-bottom:0.5rem;';
        var stars = '\u2605'.repeat(Math.round(r.average_rating || 0)) +
                    '\u2606'.repeat(5 - Math.round(r.average_rating || 0));
        li.innerHTML =
            '<a href="recipe.html?id=' + r.id + '" style="font-weight:700;font-style:italic;">' + escapeHtml(r.title) + '</a>' +
            '<br><span class="text-muted" style="font-size:0.8rem;">par ' + escapeHtml(r.author || '—') +
            ' &middot; ' + stars + ' (' + (r.rating_count || 0) + ')</span>';
        list.appendChild(li);
    });
    container.appendChild(list);
}

function renderTopContent(data) {
    renderTopViewed(data.top_viewed);
    renderTopRated(data.top_rated);
}

// ====== RENDER PENDING TABLE ======

function renderPendingTable(recipes) {
    var loadingEl = document.getElementById('moderation-loading');
    var emptyEl = document.getElementById('moderation-empty');
    var wrapperEl = document.getElementById('moderation-table-wrapper');
    var tbody = document.getElementById('moderation-tbody');

    toggleDisplay(loadingEl, false);

    if (!recipes || recipes.length === 0) {
        toggleDisplay(emptyEl, true);
        toggleDisplay(wrapperEl, false);
        return;
    }

    toggleDisplay(emptyEl, false);
    toggleDisplay(wrapperEl, true);
    tbody.innerHTML = '';
    pendingRecipes = recipes;

    recipes.forEach(function(r) {
        var tr = document.createElement('tr');
        tr.id = 'pending-row-' + r.id;
        tr.style.borderBottom = 'var(--border-thin)';

        var dateStr = r.created_at ? new Date(r.created_at).toLocaleDateString('fr-FR') : '—';
        var costStr = r.cost_per_portion ? Number(r.cost_per_portion).toFixed(2).replace('.', ',') + ' €' : '—';
        var timeStr = r.prep_time ? formatTime(r.prep_time) : '—';

        var statusLabel = '';
        if (r.status === 'published') statusLabel = 'Publiée';
        else if (r.status === 'pending') statusLabel = 'En attente';
        else if (r.status === 'rejected') statusLabel = 'Non retenue';
        else statusLabel = r.status;

        var actionsHtml = '';
        if (r.status === 'pending') {
            actionsHtml +=
                '<button type="button" class="btn-action" style="border-color:var(--success);color:var(--success);margin-right:0.5rem;" ' +
                    'data-action="publish" data-id="' + r.id + '" aria-label="Publier ' + escapeAttr(r.title) + '">' +
                    'Publier' +
                '</button>' +
                '<button type="button" class="btn-action" style="border-color:var(--error);color:var(--error);margin-right:0.5rem;" ' +
                    'data-action="reject" data-id="' + r.id + '" aria-label="Rejeter ' + escapeAttr(r.title) + '">' +
                    'Rejeter' +
                '</button>';
        }
        actionsHtml +=
            '<button type="button" class="btn-action" style="border-color:#d32f2f;color:#d32f2f;" ' +
                'data-action="delete" data-id="' + r.id + '" aria-label="Supprimer ' + escapeAttr(r.title) + '">' +
                'Supprimer' +
            '</button>';

        tr.innerHTML =
            '<td style="padding:0.75rem 0.5rem;"><a href="recipe.html?id=' + r.id + '" style="font-weight:700;font-style:italic;">' +
                escapeHtml(r.title) +
            '</a></td>' +
            '<td style="padding:0.75rem 0.5rem;">' + escapeHtml(r.author || '—') + '</td>' +
            '<td style="padding:0.75rem 0.5rem;white-space:nowrap;">' + statusLabel + '</td>' +
            '<td style="padding:0.75rem 0.5rem;white-space:nowrap;">' + dateStr + '</td>' +
            '<td style="padding:0.75rem 0.5rem;white-space:nowrap;">' + costStr + '</td>' +
            '<td style="padding:0.75rem 0.5rem;white-space:nowrap;">' + timeStr + '</td>' +
            '<td style="padding:0.75rem 0.5rem;white-space:nowrap;">' + actionsHtml + '</td>';

        tbody.appendChild(tr);
    });

    // Wire action buttons
    tbody.querySelectorAll('[data-action]').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var action = btn.getAttribute('data-action');
            var id = btn.getAttribute('data-id');
            if (action === 'publish') {
                publishRecipe(id, btn);
            } else if (action === 'reject') {
                rejectRecipe(id, btn);
            } else if (action === 'delete') {
                deleteRecipe(id, btn);
            }
        });
    });
}

// ====== MODERATION ACTIONS ======

async function publishRecipe(id, btn) {
    if (!confirm('Publier cette recette ?')) return;

    btn.disabled = true;
    btn.textContent = 'Publication...';

    try {
        await apiRequest('/admin/recipes/' + id + '/status', {
            method: 'PATCH',
            body: { status: 'published' }
        });

        announceFeedback('Recette publiée');
        removePendingRow(id);
    } catch (error) {
        alert(error.message || 'Erreur lors de la publication');
        btn.disabled = false;
        btn.textContent = 'Publier';
    }
}

async function rejectRecipe(id, btn) {
    var reason = prompt('Motif du rejet (optionnel) :');
    if (reason === null) return; // cancelled

    btn.disabled = true;
    btn.textContent = 'Rejet...';

    try {
        var body = { status: 'rejected' };
        if (reason && reason.trim()) {
            body.rejection_reason = reason.trim();
        }

        await apiRequest('/admin/recipes/' + id + '/status', {
            method: 'PATCH',
            body: body
        });

        announceFeedback('Recette rejetée');
        removePendingRow(id);
    } catch (error) {
        alert(error.message || 'Erreur lors du rejet');
        btn.disabled = false;
        btn.textContent = 'Rejeter';
    }
}

async function deleteRecipe(id, btn) {
    if (!confirm('Supprimer définitivement cette recette ?')) return;

    btn.disabled = true;
    btn.textContent = 'Suppression...';

    try {
        await apiRequest('/admin/recipes/' + id, {
            method: 'DELETE'
        });

        announceFeedback('Recette supprimée');
        removePendingRow(id);
    } catch (error) {
        alert(error.message || 'Erreur lors de la suppression');
        btn.disabled = false;
        btn.textContent = 'Supprimer';
    }
}

function removePendingRow(id) {
    var row = document.getElementById('pending-row-' + id);
    if (row) {
        row.style.background = 'var(--success)';
        row.style.opacity = '0.4';
        row.style.transition = 'opacity 0.3s';
        setTimeout(function() {
            row.remove();
            // Check if table is now empty
            var tbody = document.getElementById('moderation-tbody');
            if (tbody && tbody.children.length === 0) {
                toggleDisplay(document.getElementById('moderation-table-wrapper'), false);
                toggleDisplay(document.getElementById('moderation-empty'), true);
            }
        }, 400);
    }
}

function announceFeedback(message) {
    var el = document.getElementById('moderation-feedback');
    if (el) {
        el.textContent = message;
    }
}

// ====== RENDER LOGS ======

function renderLogs(logs) {
    var loadingEl = document.getElementById('logs-loading');
    var emptyEl = document.getElementById('logs-empty');
    var wrapperEl = document.getElementById('logs-table-wrapper');
    var tbody = document.getElementById('logs-tbody');

    toggleDisplay(loadingEl, false);

    if (!logs || logs.length === 0) {
        toggleDisplay(emptyEl, true);
        toggleDisplay(wrapperEl, false);
        return;
    }

    toggleDisplay(emptyEl, false);
    toggleDisplay(wrapperEl, true);
    tbody.innerHTML = '';

    logs.forEach(function(log) {
        var tr = document.createElement('tr');
        tr.style.borderBottom = 'var(--border-thin)';
        var dateStr = log.created_at ? new Date(log.created_at).toLocaleDateString('fr-FR') : '—';
        tr.innerHTML =
            '<td style="padding:0.5rem;">' + log.id + '</td>' +
            '<td style="padding:0.5rem;">' + escapeHtml(log.admin_name || 'Admin #' + log.admin_id) + '</td>' +
            '<td style="padding:0.5rem;"><span class="status-badge">' + escapeHtml(log.action) + '</span></td>' +
            '<td style="padding:0.5rem;">' + escapeHtml(log.target_type || '—') + ' #' + (log.target_id || log.recipe_id || '—') + '</td>' +
            '<td style="padding:0.5rem;white-space:nowrap;">' + dateStr + '</td>';
        tbody.appendChild(tr);
    });
}

// ====== CSV EXPORT ======

function setupExport() {
    var btn = document.getElementById('export-csv-btn');
    if (!btn) return;
    btn.addEventListener('click', function() {
        var token = getToken();
        fetch('/api/v1/admin/export/recipes', {
            headers: { 'Authorization': 'Bearer ' + token }
        })
        .then(function(res) {
            if (!res.ok) throw new Error('Export failed');
            return res.blob();
        })
        .then(function(blob) {
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = 'recettes.csv';
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        })
        .catch(function(err) {
            console.error('CSV export error:', err);
        });
    });
}

// ====== UTILITY ======

function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function escapeAttr(str) {
    if (!str) return '';
    return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ====== INIT ======

async function initModerationPanel() {
    // Check auth first
    if (!requireAuth('login.html?redirect=moderation-panel.html')) return;

    // Check admin role
    var user = getCurrentUser();
    if (!user || user.role !== 'admin') {
        toggleDisplay(document.getElementById('loading-state'), false);
        toggleDisplay(document.getElementById('unauthorized-state'), true);
        return;
    }

    toggleDisplay(document.getElementById('loading-state'), true);
    toggleDisplay(document.getElementById('error-state'), false);
    toggleDisplay(document.getElementById('dashboard-content'), false);
    toggleDisplay(document.getElementById('unauthorized-state'), false);

    try {
        var dashResult = await fetchDashboard();
        var pendingResult = await fetchPendingRecipes();
        var logsResult = await fetchLogs();

        renderStats(dashResult);
        renderTopContent(dashResult);
        renderPendingTable(pendingResult.data || pendingResult);
        renderLogs(logsResult.data || logsResult);
        setupExport();

        toggleDisplay(document.getElementById('loading-state'), false);
        toggleDisplay(document.getElementById('dashboard-content'), true);

    } catch (error) {
        toggleDisplay(document.getElementById('loading-state'), false);
        toggleDisplay(document.getElementById('error-state'), true);
        document.getElementById('error-message').textContent =
            error.message || 'Impossible de charger les données.';
    }
}

initModerationPanel();
