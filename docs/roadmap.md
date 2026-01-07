# Product Roadmap

This roadmap prioritizes future features based on user value for the AI Career Coach RAG system. Features are organized by priority tiers and include estimated effort and impact.

## Priority Framework

- **High Priority**: Directly improves answer quality, content freshness, or core user workflows
- **Medium Priority**: Enhances user experience and productivity
- **Low Priority**: Advanced features that add value but aren't critical for core use cases

---

## High Priority Features

### 1. Document Refresh & Re-ingestion (Phase 15)
**User Value**: ⭐⭐⭐⭐⭐ | **Effort**: Medium | **Impact**: High

**Why it matters**: Job postings, salary data, and career advice change frequently. Users need current information.

**Features**:
- [ ] Scheduled re-fetching for URLs (daily/weekly/monthly)
- [ ] Change detection (compare content hashes)
- [ ] Incremental updates (only re-chunk changed sections)
- [ ] Version history for documents
- [ ] Notification system for updated content
- [ ] Manual refresh trigger in UI
- [ ] Configurable refresh intervals per document type

**Use Cases**:
- Auto-update job postings from company career pages
- Refresh salary data quarterly
- Keep career advice articles current

---

### 2. Advanced Web Crawling & Sitemap Support (Phase 15)
**User Value**: ⭐⭐⭐⭐⭐ | **Effort**: High | **Impact**: High

**Why it matters**: Automates discovery of career resources, job postings, and industry content without manual URL entry.

**Features**:
- [ ] Robots.txt compliance and parsing
- [ ] XML sitemap parsing and discovery
- [ ] Link following with configurable depth limits
- [ ] Domain allowlist/blocklist
- [ ] Queue-based crawling with rate limiting
- [ ] Deduplication and canonical URL handling
- [ ] Crawl progress tracking and resumption
- [ ] Configurable crawl depth and limits

**Use Cases**:
- Crawl entire job board sections
- Discover all articles from a career blog
- Index company career pages comprehensively

---

### 3. Export & Sharing Features (Phase 15)
**User Value**: ⭐⭐⭐⭐ | **Effort**: Medium | **Impact**: Medium-High

**Why it matters**: Users want to save, share, and reference career insights outside the system.

**Features**:
- [ ] Export conversations to PDF/Markdown
- [ ] Share answer links (read-only, shareable URLs)
- [ ] Copy formatted answers with citations
- [ ] Save favorite answers to personal library
- [ ] Generate summary reports (e.g., "Career Path Analysis")
- [ ] Email export functionality
- [ ] Print-friendly formatting

**Use Cases**:
- Share career advice with a mentor
- Save interview prep answers for later review
- Create a portfolio of career insights
- Export conversation history for records

---

### 4. User Feedback & Query Refinement (Phase 15)
**User Value**: ⭐⭐⭐⭐ | **Effort**: Medium | **Impact**: High

**Why it matters**: Improves answer quality over time and helps users get better results.

**Features**:
- [ ] Thumbs up/down on answers
- [ ] "Regenerate answer" with refinement options
- [ ] Query suggestions based on history
- [ ] Report incorrect/incomplete answers
- [ ] Track answer quality metrics
- [ ] Learn from feedback to improve future answers
- [ ] Feedback analytics dashboard

**Use Cases**:
- Improve answers that weren't helpful
- Get better results by refining questions
- System learns what users find valuable

---

## Medium Priority Features

### 5. Advanced Search & Filtering UI (Phase 16)
**User Value**: ⭐⭐⭐ | **Effort**: Medium | **Impact**: Medium

**Why it matters**: Helps power users find specific information quickly and efficiently.

**Features**:
- [ ] Search within chat history
- [ ] Filter by document type, date range, source
- [ ] Advanced query syntax (AND, OR, NOT)
- [ ] Saved searches/bookmarks
- [ ] Search suggestions/autocomplete
- [ ] Date range filters
- [ ] Source-specific search

**Use Cases**:
- Find a specific answer from last week
- Search only job postings from last month
- Create saved searches for recurring questions

---

### 6. Enhanced Source Cards & Document Preview (Phase 16)
**User Value**: ⭐⭐⭐ | **Effort**: Medium | **Impact**: Medium

**Why it matters**: Better citation experience helps users verify and explore sources.

**Features**:
- [ ] Inline document previews (modal/expandable)
- [ ] Expandable source cards with full context
- [ ] Jump to exact location in source document
- [ ] Highlight relevant sections in preview
- [ ] Document metadata display (author, date, source URL)
- [ ] Visual indicators for source quality/relevance

**Use Cases**:
- Quickly verify source without leaving chat
- Explore full context around a citation
- Understand document provenance

---

### 7. Document Relationships & Knowledge Graph (Phase 17)
**User Value**: ⭐⭐⭐ | **Effort**: High | **Impact**: Medium

**Why it matters**: Helps discover related career paths, skills, and opportunities.

**Features**:
- [ ] Auto-detect related documents
- [ ] Build knowledge graph of concepts
- [ ] "See also" suggestions in answers
- [ ] Document clusters by topic
- [ ] Visual graph of relationships
- [ ] Related document recommendations

**Use Cases**:
- Discover related career paths
- Find complementary skills
- Explore related job opportunities

---

## Low Priority Features

### 8. Multi-Modal Content Support (Phase 17)
**User Value**: ⭐⭐ | **Effort**: High | **Impact**: Low-Medium

**Why it matters**: Some documents contain important visual information (charts, tables, images).

**Features**:
- [ ] Extract text from images (OCR)
- [ ] Parse tables from PDFs/Excel
- [ ] Extract data from charts/graphs
- [ ] Image search capabilities
- [ ] Handle embedded media

**Use Cases**:
- Extract data from salary comparison charts
- Parse resume formatting
- Extract information from infographics

**Note**: Complex to implement, lower immediate value for text-based career coaching.

---

### 9. Batch Operations & Bulk Management (Phase 18)
**User Value**: ⭐⭐ | **Effort**: Low-Medium | **Impact**: Low

**Why it matters**: Useful for administrators managing large document collections.

**Features**:
- [ ] Bulk upload/delete documents
- [ ] Batch URL ingestion
- [ ] Bulk content type assignment
- [ ] Export document metadata
- [ ] Bulk re-chunking with new strategies

**Use Cases**:
- Import 100+ job postings at once
- Reorganize document categories
- Bulk cleanup of outdated content

**Note**: More valuable for power users/admins than typical end users.

---

### 10. Advanced Analytics & Insights (Phase 18)
**User Value**: ⭐⭐ | **Effort**: Medium | **Impact**: Low

**Why it matters**: Helps understand usage patterns and optimize the system.

**Features**:
- [ ] Query analytics (popular questions, trends)
- [ ] Document usage statistics
- [ ] Answer quality metrics
- [ ] User engagement tracking
- [ ] Cost monitoring (API usage)
- [ ] Performance dashboards

**Use Cases**:
- Understand what users are asking
- Identify gaps in content coverage
- Monitor system costs

**Note**: More valuable for system administrators than end users.

---

## Implementation Timeline Suggestion

### Q1 (Next Quarter)
1. **Document Refresh & Re-ingestion** - Critical for keeping content current
2. **User Feedback & Query Refinement** - Improves system quality quickly

### Q2
3. **Advanced Web Crawling** - Automates content discovery
4. **Export & Sharing Features** - High user demand

### Q3
5. **Advanced Search & Filtering UI** - Power user features
6. **Enhanced Source Cards** - UX improvements

### Q4
7. **Document Relationships** - Advanced discovery features
8. **Multi-Modal Support** - If needed based on user feedback

---

## Notes

- Priorities may shift based on user feedback and usage patterns
- Some features can be implemented incrementally (e.g., start with basic export, add formats later)
- Consider user research to validate priorities before major implementations
- Monitor feature usage to inform future prioritization



